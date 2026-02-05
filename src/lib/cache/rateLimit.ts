import { getRedisClient } from './getRedisClient';
import { NextResponse } from 'next/server';

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
}

/**
 * Fixed-window rate limiter using Redis INCR + EXPIRE.
 * Returns whether the request should proceed, the remaining quota,
 * and seconds until the window resets.
 *
 * Gracefully allows requests when Redis is unavailable.
 */
export async function checkRateLimit(
  userId: string,
  endpoint: string,
  maxRequests: number = 30,
  windowSeconds: number = 60
): Promise<RateLimitResult> {
  const client = await getRedisClient();
  if (!client) {
    return { allowed: true, remaining: maxRequests, resetIn: 0 };
  }

  const key = `ratelimit:${userId}:${endpoint}`;

  try {
    const count = await client.incr(key);

    // Set expiry only on the first request in the window
    if (count === 1) {
      await client.expire(key, windowSeconds);
    }

    const ttl = await client.ttl(key);

    return {
      allowed: count <= maxRequests,
      remaining: Math.max(0, maxRequests - count),
      resetIn: ttl > 0 ? ttl : windowSeconds,
    };
  } catch (error) {
    console.error('Rate limit check failed:', error instanceof Error ? error.message : 'Unknown');
    return { allowed: true, remaining: maxRequests, resetIn: 0 };
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
