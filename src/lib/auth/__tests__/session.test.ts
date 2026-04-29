/**
 * Tests for session management.
 *
 * Mocks Redis client to test session creation, validation,
 * invalidation, lockout logic, and graceful fallbacks.
 */

// --- Redis mock ---
const mockRedisClient = {
  setEx: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(1),
  sAdd: jest.fn().mockResolvedValue(1),
  sMembers: jest.fn().mockResolvedValue([]),
  sRem: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(true),
  incr: jest.fn().mockResolvedValue(1),
  ttl: jest.fn().mockResolvedValue(300),
  exists: jest.fn().mockResolvedValue(0),
};

const mockGetRedisClient = jest.fn().mockResolvedValue(mockRedisClient);

jest.mock('@/lib/cache/getRedisClient', () => ({
  getRedisClient: () => mockGetRedisClient(),
}));

import {
  generateSessionToken,
  createSession,
  validateSession,
  invalidateSession,
  invalidateAllUserSessions,
  isLoginLockedOut,
  recordFailedLogin,
  clearLoginAttempts,
  getSessionDuration,
} from '../session';

describe('generateSessionToken', () => {
  it('returns a 64-char hex string', () => {
    const token = generateSessionToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates unique tokens', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateSessionToken()));
    expect(tokens.size).toBe(50);
  });
});

describe('createSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRedisClient.mockResolvedValue(mockRedisClient);
  });

  it('creates a session and returns token + expiry', async () => {
    const result = await createSession('user-1', 'parent');

    expect(result).not.toBeNull();
    expect(result!.token).toHaveLength(64);
    expect(result!.expiresAt).toBeInstanceOf(Date);
    expect(result!.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('stores session in Redis with correct key prefix', async () => {
    const result = await createSession('user-1', 'parent');

    expect(mockRedisClient.setEx).toHaveBeenCalledWith(
      `session:${result!.token}`,
      expect.any(Number),
      expect.any(String)
    );
  });

  it('stores session data with correct fields', async () => {
    await createSession('user-1', 'child', { userAgent: 'TestBrowser', ipAddress: '127.0.0.1' });

    const storedJson = mockRedisClient.setEx.mock.calls[0][2];
    const stored = JSON.parse(storedJson);

    expect(stored.userId).toBe('user-1');
    expect(stored.role).toBe('child');
    expect(stored.userAgent).toBe('TestBrowser');
    expect(stored.ipAddress).toBe('127.0.0.1');
    expect(stored.createdAt).toBeDefined();
    expect(stored.expiresAt).toBeDefined();
  });

  it('adds token to user_sessions set', async () => {
    const result = await createSession('user-1', 'parent');

    expect(mockRedisClient.sAdd).toHaveBeenCalledWith(
      'user_sessions:user-1',
      result!.token
    );
  });

  it('returns null when Redis is unavailable', async () => {
    mockGetRedisClient.mockResolvedValue(null);

    const result = await createSession('user-1', 'parent');
    expect(result).toBeNull();
  });

  it('returns null when Redis throws during setEx', async () => {
    mockRedisClient.setEx.mockRejectedValueOnce(new Error('Connection lost'));

    const result = await createSession('user-1', 'parent');
    expect(result).toBeNull();
  });

  it('uses correct TTL for each role', async () => {
    await createSession('u1', 'parent');
    expect(mockRedisClient.setEx.mock.calls[0][1]).toBe(7 * 24 * 60 * 60); // 7 days

    jest.clearAllMocks();
    await createSession('u2', 'child');
    expect(mockRedisClient.setEx.mock.calls[0][1]).toBe(24 * 60 * 60); // 1 day

    jest.clearAllMocks();
    await createSession('u3', 'guest');
    expect(mockRedisClient.setEx.mock.calls[0][1]).toBe(10 * 60); // 10 min
  });
});

describe('validateSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRedisClient.mockResolvedValue(mockRedisClient);
  });

  it('returns session data for a valid session', async () => {
    const sessionData = {
      userId: 'user-1', role: 'parent',
      createdAt: Date.now(), expiresAt: Date.now() + 60000,
    };
    mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(sessionData));

    const result = await validateSession('valid-token');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.session.userId).toBe('user-1');
    expect(result.session.role).toBe('parent');
    expect(result.session.createdAt).toBe(sessionData.createdAt);
    // Sliding window refreshes expiresAt to full session duration
    expect(result.session.expiresAt).toBeGreaterThanOrEqual(sessionData.expiresAt);
  });

  it('refreshes TTL on successful validation (sliding window)', async () => {
    const sessionData = {
      userId: 'user-1', role: 'parent',
      createdAt: Date.now(), expiresAt: Date.now() + 60000,
    };
    mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(sessionData));

    await validateSession('valid-token');

    // Should write back with refreshed TTL (parent = 7 days)
    expect(mockRedisClient.setEx).toHaveBeenCalledWith(
      'session:valid-token',
      7 * 24 * 60 * 60,
      expect.any(String)
    );
  });

  it('returns invalid for missing session', async () => {
    mockRedisClient.get.mockResolvedValueOnce(null);

    const result = await validateSession('missing-token');
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('returns invalid and deletes expired session', async () => {
    const expiredSession = {
      userId: 'user-1', role: 'parent',
      createdAt: Date.now() - 120000, expiresAt: Date.now() - 60000, // expired 1 min ago
    };
    mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(expiredSession));

    const result = await validateSession('expired-token');

    expect(result).toEqual({ ok: false, reason: 'invalid' });
    expect(mockRedisClient.del).toHaveBeenCalledWith('session:expired-token');
  });

  it('returns invalid for empty token', async () => {
    const result = await validateSession('');
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('returns unavailable when Redis is unreachable', async () => {
    mockGetRedisClient.mockResolvedValue(null);

    const result = await validateSession('some-token');
    expect(result).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('returns unavailable when Redis throws', async () => {
    mockRedisClient.get.mockRejectedValueOnce(new Error('timeout'));

    const result = await validateSession('error-token');
    expect(result).toEqual({ ok: false, reason: 'unavailable' });
  });
});

describe('invalidateSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRedisClient.mockResolvedValue(mockRedisClient);
  });

  it('deletes the session key', async () => {
    await invalidateSession('token-123');

    expect(mockRedisClient.del).toHaveBeenCalledWith('session:token-123');
  });

  it('removes token from user_sessions set when userId provided', async () => {
    await invalidateSession('token-123', 'user-1');

    expect(mockRedisClient.sRem).toHaveBeenCalledWith('user_sessions:user-1', 'token-123');
  });

  it('does not touch user_sessions when userId not provided', async () => {
    await invalidateSession('token-123');

    expect(mockRedisClient.sRem).not.toHaveBeenCalled();
  });

  it('does nothing when Redis is unavailable', async () => {
    mockGetRedisClient.mockResolvedValue(null);

    await invalidateSession('token-123', 'user-1');
    expect(mockRedisClient.del).not.toHaveBeenCalled();
  });
});

describe('invalidateAllUserSessions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRedisClient.mockResolvedValue(mockRedisClient);
  });

  it('deletes all session keys and the user_sessions set', async () => {
    mockRedisClient.sMembers.mockResolvedValueOnce(['token-a', 'token-b', 'token-c']);

    await invalidateAllUserSessions('user-1');

    expect(mockRedisClient.del).toHaveBeenCalledWith('session:token-a');
    expect(mockRedisClient.del).toHaveBeenCalledWith('session:token-b');
    expect(mockRedisClient.del).toHaveBeenCalledWith('session:token-c');
    expect(mockRedisClient.del).toHaveBeenCalledWith('user_sessions:user-1');
  });

  it('handles user with no sessions', async () => {
    mockRedisClient.sMembers.mockResolvedValueOnce([]);

    await invalidateAllUserSessions('user-1');

    // Should still delete the set key
    expect(mockRedisClient.del).toHaveBeenCalledWith('user_sessions:user-1');
  });
});

describe('isLoginLockedOut', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRedisClient.mockResolvedValue(mockRedisClient);
  });

  it('returns not locked out when no attempts recorded', async () => {
    mockRedisClient.get.mockResolvedValueOnce(null);

    const result = await isLoginLockedOut('user-1');
    expect(result.lockedOut).toBe(false);
  });

  it('returns not locked out when attempts < MAX_LOGIN_ATTEMPTS', async () => {
    mockRedisClient.get.mockResolvedValueOnce('3'); // 3 < 5

    const result = await isLoginLockedOut('user-1');
    expect(result.lockedOut).toBe(false);
  });

  it('returns locked out when attempts >= MAX_LOGIN_ATTEMPTS', async () => {
    mockRedisClient.get.mockResolvedValueOnce('5');
    mockRedisClient.ttl.mockResolvedValueOnce(180);

    const result = await isLoginLockedOut('user-1');
    expect(result.lockedOut).toBe(true);
    expect(result.retryAfter).toBe(180);
  });

  it('uses LOCKOUT_DURATION as retryAfter when TTL is expired', async () => {
    mockRedisClient.get.mockResolvedValueOnce('10');
    mockRedisClient.ttl.mockResolvedValueOnce(-1); // no TTL

    const result = await isLoginLockedOut('user-1');
    expect(result.lockedOut).toBe(true);
    expect(result.retryAfter).toBe(300); // 5 * 60
  });

  it('returns not locked out when Redis is unavailable (fail open)', async () => {
    mockGetRedisClient.mockResolvedValue(null);

    const result = await isLoginLockedOut('user-1');
    expect(result.lockedOut).toBe(false);
  });
});

describe('recordFailedLogin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRedisClient.mockResolvedValue(mockRedisClient);
  });

  it('increments attempt counter', async () => {
    mockRedisClient.incr.mockResolvedValueOnce(1);

    await recordFailedLogin('user-1');

    expect(mockRedisClient.incr).toHaveBeenCalledWith('login_attempts:user-1');
  });

  it('sets expiry on first attempt', async () => {
    mockRedisClient.incr.mockResolvedValueOnce(1);

    await recordFailedLogin('user-1');

    expect(mockRedisClient.expire).toHaveBeenCalledWith('login_attempts:user-1', 300);
  });

  it('does not reset expiry on subsequent attempts', async () => {
    mockRedisClient.incr.mockResolvedValueOnce(3);

    await recordFailedLogin('user-1');

    expect(mockRedisClient.expire).not.toHaveBeenCalled();
  });

  it('returns remaining attempts', async () => {
    mockRedisClient.incr.mockResolvedValueOnce(3);

    const result = await recordFailedLogin('user-1');
    expect(result.remainingAttempts).toBe(2); // 5 - 3
  });

  it('returns 0 remaining when at max', async () => {
    mockRedisClient.incr.mockResolvedValueOnce(5);

    const result = await recordFailedLogin('user-1');
    expect(result.remainingAttempts).toBe(0);
  });

  it('returns max attempts when Redis unavailable (fail open)', async () => {
    mockGetRedisClient.mockResolvedValue(null);

    const result = await recordFailedLogin('user-1');
    expect(result.remainingAttempts).toBe(5);
  });
});

describe('clearLoginAttempts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRedisClient.mockResolvedValue(mockRedisClient);
  });

  it('deletes the login_attempts key', async () => {
    await clearLoginAttempts('user-1');

    expect(mockRedisClient.del).toHaveBeenCalledWith('login_attempts:user-1');
  });

  it('does nothing when Redis is unavailable', async () => {
    mockGetRedisClient.mockResolvedValue(null);

    await clearLoginAttempts('user-1');
    expect(mockRedisClient.del).not.toHaveBeenCalled();
  });
});

describe('getSessionDuration', () => {
  it('returns parent duration in ms', () => {
    expect(getSessionDuration('parent')).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('returns child duration in ms', () => {
    expect(getSessionDuration('child')).toBe(24 * 60 * 60 * 1000);
  });

  it('returns guest duration in ms', () => {
    expect(getSessionDuration('guest')).toBe(10 * 60 * 1000);
  });
});
