import { getRedisClient } from '@/lib/cache/getRedisClient';
import { SESSION_DURATION, MAX_LOGIN_ATTEMPTS, LOCKOUT_DURATION } from '@/lib/constants';

export interface SessionData {
  userId: string;
  role: 'parent' | 'child' | 'guest';
  createdAt: number;
  expiresAt: number;
  userAgent?: string;
  ipAddress?: string;
}

export function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a new session. Returns null if Redis is unavailable —
 * callers must treat null as "service unavailable" rather than
 * issuing an unusable token (zombie session).
 */
export async function createSession(
  userId: string,
  role: 'parent' | 'child' | 'guest',
  metadata?: { userAgent?: string; ipAddress?: string }
): Promise<{ token: string; expiresAt: Date } | null> {
  const client = await getRedisClient();

  if (!client) {
    console.error('Redis not available — cannot create session');
    return null;
  }

  const durationKey = role.toUpperCase() as keyof typeof SESSION_DURATION;
  const duration = SESSION_DURATION[durationKey];
  const token = generateSessionToken();
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

  try {
    const sessionKey = `session:${token}`;
    await client.setEx(sessionKey, duration, JSON.stringify(sessionData));

    const userSessionsKey = `user_sessions:${userId}`;
    await client.sAdd(userSessionsKey, token);
    await client.expire(userSessionsKey, duration);

    return { token, expiresAt };
  } catch (error) {
    console.error('Failed to create session:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

export async function validateSession(token: string): Promise<SessionData | null> {
  if (!token) return null;

  const client = await getRedisClient();
  if (!client) return null;

  try {
    const sessionKey = `session:${token}`;
    const data = await client.get(sessionKey);
    if (!data) return null;

    const sessionData = JSON.parse(data) as SessionData;

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

export async function invalidateSession(token: string, userId?: string): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;

  try {
    await client.del(`session:${token}`);
    if (userId) {
      await client.sRem(`user_sessions:${userId}`, token);
    }
  } catch (error) {
    console.error('Failed to invalidate session:', error instanceof Error ? error.message : 'Unknown error');
  }
}

export async function invalidateAllUserSessions(userId: string): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;

  try {
    const userSessionsKey = `user_sessions:${userId}`;
    const tokens = await client.sMembers(userSessionsKey);

    for (const token of tokens) {
      await client.del(`session:${token}`);
    }
    await client.del(userSessionsKey);
  } catch (error) {
    console.error('Failed to invalidate user sessions:', error instanceof Error ? error.message : 'Unknown error');
  }
}

export async function isLoginLockedOut(userId: string): Promise<{ lockedOut: boolean; retryAfter?: number }> {
  const client = await getRedisClient();
  if (!client) return { lockedOut: false };

  try {
    const attemptsKey = `login_attempts:${userId}`;
    const attempts = await client.get(attemptsKey);
    if (!attempts) return { lockedOut: false };

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

export async function recordFailedLogin(userId: string): Promise<{ remainingAttempts: number }> {
  const client = await getRedisClient();
  if (!client) return { remainingAttempts: MAX_LOGIN_ATTEMPTS };

  try {
    const attemptsKey = `login_attempts:${userId}`;
    const newCount = await client.incr(attemptsKey);

    if (newCount === 1) {
      await client.expire(attemptsKey, LOCKOUT_DURATION);
    }

    return { remainingAttempts: Math.max(0, MAX_LOGIN_ATTEMPTS - newCount) };
  } catch (error) {
    console.error('Failed to record failed login:', error instanceof Error ? error.message : 'Unknown error');
    return { remainingAttempts: MAX_LOGIN_ATTEMPTS };
  }
}

export async function clearLoginAttempts(userId: string): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;

  try {
    await client.del(`login_attempts:${userId}`);
  } catch (error) {
    console.error('Failed to clear login attempts:', error instanceof Error ? error.message : 'Unknown error');
  }
}

export function getSessionDuration(role: 'parent' | 'child' | 'guest'): number {
  const durationKey = role.toUpperCase() as keyof typeof SESSION_DURATION;
  return SESSION_DURATION[durationKey] * 1000;
}
