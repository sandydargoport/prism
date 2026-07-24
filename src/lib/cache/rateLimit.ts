import { getRedisClient } from './getRedisClient';
import { NextResponse } from 'next/server';

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
}

// ---------------------------------------------------------------------------
// In-memory fallback limiter (used when Redis is unavailable)
// Fixed-window, per-process. Accurate enough for a single-instance deployment.
// ---------------------------------------------------------------------------

interface MemoryWindow {
  count: number;
  expiresAt: number; // ms epoch
}

const memoryStore = new Map<string, MemoryWindow>();

// Prune expired entries periodically to prevent unbounded growth
setInterval(() => {
  const now = Date.now();
  for (const [key, window] of memoryStore) {
    if (window.expiresAt <= now) memoryStore.delete(key);
  }
}, 60_000);

function checkMemoryRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): RateLimitResult {
  const now = Date.now();
  const existing = memoryStore.get(key);

  if (!existing || existing.expiresAt <= now) {
    memoryStore.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: maxRequests - 1, resetIn: windowSeconds };
  }

  existing.count += 1;
  const resetIn = Math.ceil((existing.expiresAt - now) / 1000);
  return {
    allowed: existing.count <= maxRequests,
    remaining: Math.max(0, maxRequests - existing.count),
    resetIn,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fixed-window rate limiter using Redis INCR + EXPIRE.
 * Falls back to an in-memory limiter when Redis is unavailable.
 */
export async function checkRateLimit(
  userId: string,
  endpoint: string,
  maxRequests: number = 30,
  windowSeconds: number = 60
): Promise<RateLimitResult> {
  const key = `ratelimit:${userId}:${endpoint}`;
  const client = await getRedisClient();

  if (!client) {
    return checkMemoryRateLimit(key, maxRequests, windowSeconds);
  }

  try {
    const count = await client.incr(key);

    // After INCR the key always exists, so TTL is either >0 (window active) or
    // -1 (no expiry). -1 happens on the first request in a window AND when a
    // prior EXPIRE was dropped (e.g. a crash between INCR and EXPIRE). Re-issue
    // the expiry whenever there is none: otherwise the key would live forever,
    // the counter could never reset, and the user would be permanently locked
    // out once past maxRequests. This makes the window self-healing rather than
    // setting the expiry only on count === 1.
    let ttl = await client.ttl(key);
    if (ttl < 0) {
      await client.expire(key, windowSeconds);
      ttl = windowSeconds;
    }

    return {
      allowed: count <= maxRequests,
      remaining: Math.max(0, maxRequests - count),
      resetIn: ttl > 0 ? ttl : windowSeconds,
    };
  } catch (error) {
    console.error('Rate limit check failed, using memory fallback:', error instanceof Error ? error.message : 'Unknown');
    return checkMemoryRateLimit(key, maxRequests, windowSeconds);
  }
}

/**
 * Convenience wrapper: checks rate limit and returns a 429 response
 * if the user has exceeded their quota, or null if allowed.
 */
export async function rateLimitGuard(
  userId: string,
  endpoint: string,
  maxRequests: number = 30,
  windowSeconds: number = 60
): Promise<NextResponse | null> {
  const result = await checkRateLimit(userId, endpoint, maxRequests, windowSeconds);

  if (!result.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(result.resetIn),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(result.resetIn),
        },
      }
    );
  }

  return null;
}
