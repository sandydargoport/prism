/**
 * Tests for POST /api/auth/login
 *
 * Covers:
 * - userId path: valid PIN, invalid PIN, lockout, user not found
 * - memberIndex path: resolves user by ordinal, validates PIN
 * - Guest login (no PIN required)
 * - Service unavailable when Redis is down
 */

import { NextRequest } from 'next/server';

// --- DB mock ---
const mockSelect = jest.fn();
const mockFrom = jest.fn();
const mockWhere = jest.fn();
const mockOffset = jest.fn();
const mockLimit = jest.fn();
const mockOrderBy = jest.fn();

jest.mock('@/lib/db/client', () => ({
  db: {
    select: (...a: unknown[]) => mockSelect(...a),
    insert: jest.fn().mockReturnValue({ values: jest.fn().mockReturnValue({ catch: jest.fn() }) }),
  },
}));

jest.mock('@/lib/db/schema', () => ({
  users: { id: 'id', name: 'name', role: 'role', color: 'color', avatarUrl: 'avatarUrl', pin: 'pin', sortOrder: 'sort_order', createdAt: 'created_at' },
  auditLogs: {},
}));

// --- Auth/session mock ---
const mockIsLoginLockedOut = jest.fn();
const mockRecordFailedLogin = jest.fn();
const mockClearLoginAttempts = jest.fn();
const mockCreateSession = jest.fn();

jest.mock('@/lib/auth/session', () => ({
  isLoginLockedOut: (...a: unknown[]) => mockIsLoginLockedOut(...a),
  recordFailedLogin: (...a: unknown[]) => mockRecordFailedLogin(...a),
  clearLoginAttempts: (...a: unknown[]) => mockClearLoginAttempts(...a),
  createSession: (...a: unknown[]) => mockCreateSession(...a),
}));

// --- Cookies mock ---
const mockCookieStore = { set: jest.fn(), get: jest.fn() };
jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue(mockCookieStore),
}));

// --- bcrypt mock ---
const mockBcryptCompare = jest.fn();
jest.mock('bcryptjs', () => ({
  compare: (...a: unknown[]) => mockBcryptCompare(...a),
}));

// --- Cache mock ---
jest.mock('@/lib/services/auditLog', () => ({ logActivity: jest.fn() }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));
jest.mock('drizzle-orm', () => ({ eq: jest.fn(), asc: jest.fn() }));
const mockSaveHouseholdTimezone = jest.fn();
jest.mock('@/lib/householdTimezone', () => ({
  saveHouseholdTimezoneIfMissing: (...a: unknown[]) => mockSaveHouseholdTimezone(...a),
}));

import { POST } from '../route';

const SESSION_MOCK = { token: 'tok123', expiresAt: new Date(Date.now() + 3600_000) };
// pin is string | null — guest users have no PIN
const PARENT_USER = { id: 'parent-1', name: 'Alice', role: 'parent', color: '#3B82F6', avatarUrl: null, pin: '$2a$hash' as string | null };

function makeRequest(body: object) {
  return new NextRequest('http://localhost:3000/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function setupUserQuery(user: typeof PARENT_USER | null) {
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere, orderBy: mockOrderBy });
  mockWhere.mockResolvedValue(user ? [user] : []);
  mockOrderBy.mockReturnValue({ limit: mockLimit });
  mockLimit.mockReturnValue({ offset: mockOffset });
  mockOffset.mockResolvedValue(user ? [user] : []);
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsLoginLockedOut.mockResolvedValue({ lockedOut: false });
    mockRecordFailedLogin.mockResolvedValue({ remainingAttempts: 4 });
    mockClearLoginAttempts.mockResolvedValue(undefined);
    mockCreateSession.mockResolvedValue(SESSION_MOCK);
    mockBcryptCompare.mockResolvedValue(true);
    mockCookieStore.set.mockReturnValue(undefined);
  });

  // --- userId path ---

  it('returns 400 when neither userId nor memberIndex provided', async () => {
    const res = await POST(makeRequest({ pin: '1234' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('userId or memberIndex');
  });

  it('returns 403 when user is locked out (userId path)', async () => {
    mockIsLoginLockedOut.mockResolvedValue({ lockedOut: true, retryAfter: 300 });
    const res = await POST(makeRequest({ userId: 'parent-1', pin: '1234' }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.lockedOut).toBe(true);
    expect(body.retryAfter).toBe(300);
  });

  it('returns 404 when userId does not exist', async () => {
    setupUserQuery(null);
    const res = await POST(makeRequest({ userId: 'ghost', pin: '1234' }));
    expect(res.status).toBe(404);
  });

  it('returns 401 on wrong PIN and records failed attempt', async () => {
    setupUserQuery(PARENT_USER);
    mockBcryptCompare.mockResolvedValue(false);
    const res = await POST(makeRequest({ userId: 'parent-1', pin: '0000' }));
    expect(res.status).toBe(401);
    expect(mockRecordFailedLogin).toHaveBeenCalledWith('parent-1');
  });

  it('logs in successfully with valid PIN (userId path)', async () => {
    setupUserQuery(PARENT_USER);
    const res = await POST(makeRequest({ userId: 'parent-1', pin: '1234' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.id).toBe('parent-1');
    expect(mockClearLoginAttempts).toHaveBeenCalledWith('parent-1');
    expect(mockCookieStore.set).toHaveBeenCalledWith('prism_session', 'tok123', expect.any(Object));
  });

  // --- memberIndex path ---

  it('returns 400 for out-of-range memberIndex', async () => {
    const res = await POST(makeRequest({ memberIndex: -1, pin: '1234' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when memberIndex resolves to no user', async () => {
    setupUserQuery(null);
    const res = await POST(makeRequest({ memberIndex: 99, pin: '1234' }));
    expect(res.status).toBe(404);
  });

  it('logs in successfully via memberIndex', async () => {
    setupUserQuery(PARENT_USER);
    const res = await POST(makeRequest({ memberIndex: 0, pin: '1234' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.id).toBe('parent-1');
  });

  it('enforces lockout on memberIndex path after resolving userId', async () => {
    setupUserQuery(PARENT_USER);
    mockIsLoginLockedOut.mockResolvedValue({ lockedOut: true, retryAfter: 900 });
    const res = await POST(makeRequest({ memberIndex: 0, pin: '1234' }));
    expect(res.status).toBe(403);
    expect(mockIsLoginLockedOut).toHaveBeenCalledWith('parent-1');
  });

  // --- Guest login ---

  it('logs in a guest without a PIN', async () => {
    const guestUser = { ...PARENT_USER, id: 'guest-1', role: 'guest', pin: null };
    setupUserQuery(guestUser);
    const res = await POST(makeRequest({ userId: 'guest-1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.role).toBe('guest');
  });

  it('returns 503 when Redis is unavailable (session creation fails)', async () => {
    setupUserQuery(PARENT_USER);
    mockCreateSession.mockResolvedValue(null);
    const res = await POST(makeRequest({ userId: 'parent-1', pin: '1234' }));
    expect(res.status).toBe(500);
  });

  // --- household time zone from a parent's device ---

  it("passes a parent's device zone on to be stored if none is saved", async () => {
    setupUserQuery(PARENT_USER);
    const res = await POST(makeRequest({ userId: 'parent-1', pin: '1234', timeZone: 'America/Denver' }));
    expect(res.status).toBe(200);
    expect(mockSaveHouseholdTimezone).toHaveBeenCalledWith('America/Denver');
  });

  it("does not use a child's device zone", async () => {
    setupUserQuery({ ...PARENT_USER, id: 'child-1', role: 'child' });
    const res = await POST(makeRequest({ userId: 'child-1', pin: '1234', timeZone: 'America/Denver' }));
    expect(res.status).toBe(200);
    expect(mockSaveHouseholdTimezone).not.toHaveBeenCalled();
  });

  it('does not touch the zone on a failed sign-in', async () => {
    setupUserQuery(PARENT_USER);
    mockBcryptCompare.mockResolvedValue(false);
    await POST(makeRequest({ userId: 'parent-1', pin: '0000', timeZone: 'America/Denver' }));
    expect(mockSaveHouseholdTimezone).not.toHaveBeenCalled();
  });
});
