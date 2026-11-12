import { createHash } from 'crypto';
import { getRedisClient } from '@/lib/cache/getRedisClient';
import { SESSION_DURATION, SESSION_ABSOLUTE_LIFETIME, MAX_LOGIN_ATTEMPTS, LOCKOUT_TIERS, LOCKOUT_TIER_TTL } from '@/lib/constants';

export interface SessionData {
  userId: string;
  role: 'parent' | 'child' | 'guest';
  createdAt: number;
  expiresAt: number;
  userAgent?: string;
  ipAddress?: string;
  /** A parent chose "Keep this device signed in" (#1044). */
  kept?: boolean;
  /** Last successful validation, for the signed-in devices list. */
  lastUsedAt?: number;
}

/**
 * A kept device (#1044): the phone a parent ticks chores from. It slides a
 * month from its last use instead of a week, and lasts up to a year from sign
 * in instead of the role's cap. Any parent can sign it out from the list.
 */
export const KEPT_SESSION = {
  SLIDING: 30 * 24 * 60 * 60,
  ABSOLUTE: 365 * 24 * 60 * 60,
} as const;

function slidingSeconds(s: Pick<SessionData, 'role' | 'kept'>): number {
  if (s.kept) return KEPT_SESSION.SLIDING;
  return SESSION_DURATION[s.role.toUpperCase() as keyof typeof SESSION_DURATION];
}

function absoluteSeconds(s: Pick<SessionData, 'role' | 'kept'>): number {
  if (s.kept) return KEPT_SESSION.ABSOLUTE;
  return SESSION_ABSOLUTE_LIFETIME[s.role.toUpperCase() as keyof typeof SESSION_ABSOLUTE_LIFETIME];
}

/** A stable, non-secret handle for a session: never hand a token to the list. */
export function sessionId(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 24);
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
    // Never shorten the set below a kept session's life (#1044).
    const setTtl = await client.ttl(userSessionsKey);
    if (setTtl < duration) await client.expire(userSessionsKey, duration);

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
    const absoluteLifetimeMs = absoluteSeconds(sessionData) * 1000;
    if (Date.now() - sessionData.createdAt > absoluteLifetimeMs) {
      await client.del(sessionKey);
      return { ok: false, reason: 'invalid' };
    }

    // Sliding window: refresh TTL on each successful validation
    try {
      const duration = slidingSeconds(sessionData);
      const now = Date.now();
      sessionData.expiresAt = now + duration * 1000;
      sessionData.lastUsedAt = now;
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

/**
 * Keep (or stop keeping) the session behind `token` signed in (#1044).
 * Returns when its cookies should now expire, or null if it is gone.
 */
export async function setSessionKept(token: string, kept: boolean): Promise<{ cookieExpires: Date } | null> {
  const client = await getRedisClient();
  if (!client) return null;
  const key = `session:${token}`;
  const raw = await client.get(key);
  if (!raw) return null;
  const data = JSON.parse(raw) as SessionData;
  data.kept = kept;
  const now = Date.now();
  const duration = slidingSeconds(data);
  data.expiresAt = now + duration * 1000;
  await client.setEx(key, duration, JSON.stringify(data));
  if (kept) {
    const setKey = `user_sessions:${data.userId}`;
    if ((await client.ttl(setKey)) < KEPT_SESSION.ABSOLUTE) await client.expire(setKey, KEPT_SESSION.ABSOLUTE);
  }
  // A kept device's cookie lives to the session's cap; the server still
  // enforces the sliding month. Otherwise it is the ordinary sliding window.
  const cookieExpires = kept
    ? new Date((data.createdAt ?? now) + absoluteSeconds(data) * 1000)
    : new Date(data.expiresAt);
  return { cookieExpires };
}

export interface DeviceSession {
  id: string;
  userAgent?: string;
  createdAt: number;
  lastUsedAt?: number;
  kept: boolean;
  current: boolean;
}

/** The user's live sessions, newest use first; never includes a token. */
export async function listUserSessions(userId: string, currentToken?: string): Promise<DeviceSession[]> {
  const client = await getRedisClient();
  if (!client) return [];
  const setKey = `user_sessions:${userId}`;
  const out: DeviceSession[] = [];
  for (const token of await client.sMembers(setKey)) {
    const raw = await client.get(`session:${token}`);
    if (!raw) {
      await client.sRem(setKey, token);
      continue;
    }
    const d = JSON.parse(raw) as SessionData;
    out.push({
      id: sessionId(token),
      userAgent: d.userAgent,
      createdAt: d.createdAt,
      lastUsedAt: d.lastUsedAt,
      kept: d.kept === true,
      current: token === currentToken,
    });
  }
  return out.sort((a, b) => (b.lastUsedAt ?? b.createdAt) - (a.lastUsedAt ?? a.createdAt));
}

/** Sign out one of the user's sessions by its list id. False if not theirs. */
export async function revokeUserSession(userId: string, id: string): Promise<boolean> {
  const client = await getRedisClient();
  if (!client) return false;
  for (const token of await client.sMembers(`user_sessions:${userId}`)) {
    if (sessionId(token) === id) {
      await invalidateSession(token, userId);
      return true;
    }
  }
  return false;
}

/** Sign out every session of the user except `keepToken`. Returns how many. */
export async function revokeOtherSessions(userId: string, keepToken?: string): Promise<number> {
  const client = await getRedisClient();
  if (!client) return 0;
  let n = 0;
  for (const token of await client.sMembers(`user_sessions:${userId}`)) {
    if (token === keepToken) continue;
    await invalidateSession(token, userId);
    n++;
  }
  return n;
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

/**
 * Count this attempt before the PIN is checked (#809). Checking the counter,
 * then comparing the PIN (slow on purpose), then counting a failure let many
 * guesses sent at once all pass the check before any was counted. Counting
 * first is atomic: once the count passes the limit, every further attempt is
 * refused until the lockout ends. A correct PIN clears the count as before.
 */
export async function reserveLoginAttempt(
  userId: string,
): Promise<{ allowed: true; count: number } | { allowed: false; retryAfter: number }> {
  const client = await getRedisClient();
  if (!client) return { allowed: true, count: 0 };

  try {
    const attemptsKey = `login_attempts:${userId}`;
    const count = await client.incr(attemptsKey);
    if (count === 1) await client.expire(attemptsKey, LOCKOUT_TIERS[0]);
    if (count > MAX_LOGIN_ATTEMPTS) {
      const ttl = await client.ttl(attemptsKey);
      return { allowed: false, retryAfter: ttl > 0 ? ttl : LOCKOUT_TIERS[0] };
    }
    return { allowed: true, count };
  } catch (error) {
    console.error('Failed to reserve a login attempt:', error instanceof Error ? error.message : 'Unknown error');
    return { allowed: true, count: 0 };
  }
}

/**
 * A wrong PIN. Pass the count reserveLoginAttempt returned, so the attempt is
 * not counted twice; without one it counts the attempt here.
 */
export async function recordFailedLogin(userId: string, reservedCount?: number): Promise<{ remainingAttempts: number }> {
  const client = await getRedisClient();
  if (!client) return { remainingAttempts: MAX_LOGIN_ATTEMPTS };

  try {
    const attemptsKey = `login_attempts:${userId}`;
    const tierKey = `login_lockout_tier:${userId}`;
    const newCount = reservedCount && reservedCount > 0 ? reservedCount : await client.incr(attemptsKey);

    if (newCount === 1 && !(reservedCount && reservedCount > 0)) {
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
