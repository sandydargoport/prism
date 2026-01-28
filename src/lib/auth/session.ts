/**
 * ============================================================================
 * PRISM - Session Management
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Manages user sessions using Redis for distributed session storage.
 * This ensures sessions work across multiple server instances and
 * provides proper session validation and expiration.
 *
 * FEATURES:
 * - Redis-backed session storage
 * - Session token validation
 * - Automatic session expiration
 * - Rate limiting for login attempts
 *
 * ============================================================================
 */

import { createClient, RedisClientType } from 'redis';

// Session configuration
const SESSION_DURATION = {
  parent: 30 * 60,    // 30 minutes in seconds
  child: 15 * 60,     // 15 minutes in seconds
  guest: 5 * 60,      // 5 minutes in seconds
} as const;

// Rate limiting configuration
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 5 * 60; // 5 minutes in seconds

// Redis client singleton
let redisClient: RedisClientType | null = null;
let isConnecting = false;
let connectionFailed = false;

/**
 * Session data stored in Redis
 */
export interface SessionData {
  userId: string;
  role: 'parent' | 'child' | 'guest';
  createdAt: number;
  expiresAt: number;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Get or create Redis client for sessions
 */
async function getClient(): Promise<RedisClientType | null> {
  if (connectionFailed) {
    return null;
  }

  if (redisClient?.isOpen) {
    return redisClient;
  }

  if (isConnecting) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return redisClient?.isOpen ? redisClient : null;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('REDIS_URL not configured, session management disabled');
    connectionFailed = true;
    return null;
  }

  try {
    isConnecting = true;

    redisClient = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries: number) => {
          if (retries > 3) {
            console.warn('Redis connection failed, session management disabled');
            connectionFailed = true;
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 100, 1000);
        },
      },
    });

    redisClient.on('error', (err: Error) => {
      console.error('Redis session error:', err.message);
    });

    await redisClient.connect();
    isConnecting = false;

    return redisClient;
  } catch (error) {
    console.warn('Failed to connect to Redis for sessions:', error instanceof Error ? error.message : 'Unknown error');
    isConnecting = false;
    connectionFailed = true;
    return null;
  }
}

/**
 * Generate a cryptographically secure session token
 */
export function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a new session and store it in Redis
 */
export async function createSession(
  userId: string,
  role: 'parent' | 'child' | 'guest',
  metadata?: { userAgent?: string; ipAddress?: string }
): Promise<{ token: string; expiresAt: Date } | null> {
  const client = await getClient();

  const token = generateSessionToken();
  const duration = SESSION_DURATION[role];
  const now = Date.now();
  const expiresAt = new Date(now + duration * 1000);

  const sessionData: SessionData = {
    userId,
    role,
    createdAt: now,
    expiresAt: expiresAt.getTime(),
    userAgent: metadata?.userAgent,
    ipAddress: metadata?.ipAddress,
  };

  // If Redis is not available, return token anyway (fallback mode)
  // In production, you might want to fail instead
  if (!client) {
    console.warn('Redis not available, session created without storage');
    return { token, expiresAt };
  }

  try {
    const sessionKey = `session:${token}`;
    await client.setEx(sessionKey, duration, JSON.stringify(sessionData));

    // Also store a reverse lookup by user ID for session management
    const userSessionsKey = `user_sessions:${userId}`;
    await client.sAdd(userSessionsKey, token);
    await client.expire(userSessionsKey, duration);

    return { token, expiresAt };
  } catch (error) {
    console.error('Failed to create session:', error instanceof Error ? error.message : 'Unknown error');
    // Return token anyway in fallback mode
    return { token, expiresAt };
  }
}

/**
 * Validate a session token and return session data
 */
export async function validateSession(token: string): Promise<SessionData | null> {
  if (!token) {
    return null;
  }

  const client = await getClient();

  // If Redis is not available, we cannot validate
  if (!client) {
    console.warn('Redis not available, cannot validate session');
    return null;
  }

  try {
    const sessionKey = `session:${token}`;
    const data = await client.get(sessionKey);

    if (!data) {
      return null;
    }

    const sessionData = JSON.parse(data) as SessionData;

    // Check if session has expired (belt and suspenders with Redis TTL)
    if (sessionData.expiresAt < Date.now()) {
      await client.del(sessionKey);
      return null;
    }

    return sessionData;
  } catch (error) {
    console.error('Failed to validate session:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Invalidate a session token
 */
export async function invalidateSession(token: string, userId?: string): Promise<void> {
  const client = await getClient();

  if (!client) {
    return;
  }

  try {
    const sessionKey = `session:${token}`;
    await client.del(sessionKey);

    // Remove from user's session list if userId provided
    if (userId) {
      const userSessionsKey = `user_sessions:${userId}`;
      await client.sRem(userSessionsKey, token);
    }
  } catch (error) {
    console.error('Failed to invalidate session:', error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Invalidate all sessions for a user
 */
export async function invalidateAllUserSessions(userId: string): Promise<void> {
  const client = await getClient();

  if (!client) {
    return;
  }

  try {
    const userSessionsKey = `user_sessions:${userId}`;
    const tokens = await client.sMembers(userSessionsKey);

    // Delete all session keys
    for (const token of tokens) {
      await client.del(`session:${token}`);
    }

    // Delete the user sessions set
    await client.del(userSessionsKey);
  } catch (error) {
    console.error('Failed to invalidate user sessions:', error instanceof Error ? error.message : 'Unknown error');
  }
}

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Check if a user is locked out from login attempts
 */
export async function isLoginLockedOut(userId: string): Promise<{ lockedOut: boolean; retryAfter?: number }> {
  const client = await getClient();

  // If Redis not available, don't enforce rate limiting
  // This is a security trade-off for availability
  if (!client) {
    return { lockedOut: false };
  }

  try {
    const attemptsKey = `login_attempts:${userId}`;
    const attempts = await client.get(attemptsKey);

    if (!attempts) {
      return { lockedOut: false };
    }

    const count = parseInt(attempts, 10);
    if (count >= MAX_LOGIN_ATTEMPTS) {
      const ttl = await client.ttl(attemptsKey);
      return { lockedOut: true, retryAfter: ttl > 0 ? ttl : LOCKOUT_DURATION };
    }

    return { lockedOut: false };
  } catch (error) {
    console.error('Failed to check login lockout:', error instanceof Error ? error.message : 'Unknown error');
    return { lockedOut: false };
  }
}

/**
 * Record a failed login attempt
 */
export async function recordFailedLogin(userId: string): Promise<{ remainingAttempts: number }> {
  const client = await getClient();

  if (!client) {
    return { remainingAttempts: MAX_LOGIN_ATTEMPTS };
  }

  try {
    const attemptsKey = `login_attempts:${userId}`;
    const newCount = await client.incr(attemptsKey);

    // Set expiry on first attempt
    if (newCount === 1) {
      await client.expire(attemptsKey, LOCKOUT_DURATION);
    }

    return { remainingAttempts: Math.max(0, MAX_LOGIN_ATTEMPTS - newCount) };
  } catch (error) {
    console.error('Failed to record failed login:', error instanceof Error ? error.message : 'Unknown error');
    return { remainingAttempts: MAX_LOGIN_ATTEMPTS };
  }
}

/**
 * Clear login attempts after successful login
 */
export async function clearLoginAttempts(userId: string): Promise<void> {
  const client = await getClient();

  if (!client) {
    return;
  }

  try {
    const attemptsKey = `login_attempts:${userId}`;
    await client.del(attemptsKey);
  } catch (error) {
    console.error('Failed to clear login attempts:', error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Get session duration for a role
 */
export function getSessionDuration(role: 'parent' | 'child' | 'guest'): number {
  return SESSION_DURATION[role] * 1000; // Convert to milliseconds
}
