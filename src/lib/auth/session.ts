import { getRedisClient } from '@/lib/cache/getRedisClient';
import { SESSION_DURATION, SESSION_ABSOLUTE_LIFETIME, MAX_LOGIN_ATTEMPTS, LOCKOUT_TIERS, LOCKOUT_TIER_TTL } from '@/lib/constants';

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

export type ValidateSessionResult =
  | { ok: true; session: SessionData }
  | { ok: false; reason: 'invalid' | 'unavailable' };

export async function validateSession(token: string): Promise<ValidateSessionResult> {
  if (!token) return { ok: false, reason: 'invalid' };

  const client = await getRedisClient();
  if (!client) return { ok: false, reason: 'unavailable' };

  try {
    const sessionKey = `session:${token}`;
    const data = await client.get(sessionKey);
    if (!data) return { ok: false, reason: 'invalid' };

    const sessionData = JSON.parse(data) as SessionData;

    if (sessionData.expiresAt < Date.now()) {
      await client.del(sessionKey);
      return { ok: false, reason: 'invalid' };
    }

    // Absolute lifetime cap: the sliding window below refreshes expiry on
    // every use, so without this a periodically-exercised (or stolen) session
    // would never expire. Reject once the session is older than its role's
    // absolute lifetime, measured from createdAt. Sessions predating this
    // field (createdAt undefined → NaN comparison is false) are left alone.
    const absoluteKey = sessionData.role.toUpperCase() as keyof typeof SESSION_ABSOLUTE_LIFETIME;
    const absoluteLifetimeMs = SESSION_ABSOLUTE_LIFETIME[absoluteKey] * 1000;
    if (Date.now() - sessionData.createdAt > absoluteLifetimeMs) {
      await client.del(sessionKey);
      return { ok: false, reason: 'invalid' };
    }

    // Sliding window: refresh TTL on each successful validation
    try {
      const durationKey = sessionData.role.toUpperCase() as keyof typeof SESSION_DURATION;
      const duration = SESSION_DURATION[durationKey];
      const newExpiresAt = Date.now() + duration * 1000;
      sessionData.expiresAt = newExpiresAt;
      await client.setEx(sessionKey, duration, JSON.stringify(sessionData));
    } catch {
      // Non-critical — don't block response if refresh fails
    }

    return { ok: true, session: sessionData };
  } catch (error) {
    console.error('Failed to validate session:', error instanceof Error ? error.message : 'Unknown error');
    return { ok: false, reason: 'unavailable' };
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
      return { lockedOut: true, retryAfter: ttl > 0 ? ttl : LOCKOUT_TIERS[0] };
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
    const tierKey = `login_lockout_tier:${userId}`;
    const newCount = await client.incr(attemptsKey);

    if (newCount === 1) {
      // First attempt in this window — set a short initial expiry as a safety net
      await client.expire(attemptsKey, LOCKOUT_TIERS[0]);
    }

    if (newCount >= MAX_LOGIN_ATTEMPTS) {
      // Increment the lockout tier counter and pick the appropriate duration
      const tierCount = await client.incr(tierKey);
      const tierIndex = Math.min(tierCount - 1, LOCKOUT_TIERS.length - 1);
      const lockoutDuration = LOCKOUT_TIERS[tierIndex] as number;

      // Override the attempts key expiry with the escalated lockout duration
      await client.expire(attemptsKey, lockoutDuration);
      // Tier key resets after 24 h of inactivity so persistent offenders keep escalating
      await client.expire(tierKey, LOCKOUT_TIER_TTL);
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
    // Clear both the attempt counter and the tier — successful login resets the escalation ladder
    await client.del(`login_attempts:${userId}`);
    await client.del(`login_lockout_tier:${userId}`);
  } catch (error) {
    console.error('Failed to clear login attempts:', error instanceof Error ? error.message : 'Unknown error');
  }
}

export function getSessionDuration(role: 'parent' | 'child' | 'guest'): number {
  const durationKey = role.toUpperCase() as keyof typeof SESSION_DURATION;
  return SESSION_DURATION[durationKey] * 1000;
}
