/**
 * PATCH /api/family/[id]: changing a member's PIN length.
 *
 * A new length on its own strands an existing PIN (every pad waits for the new
 * number of digits; the stored hash was made from the old one), so the route
 * only accepts it together with a new PIN of that length, or a PIN removal.
 */

import { NextRequest } from 'next/server';

const mockWhere = jest.fn();
const mockSet = jest.fn();

jest.mock('@/lib/db/client', () => ({
  db: {
    select: () => ({ from: () => ({ where: (...a: unknown[]) => mockWhere(...a) }) }),
    update: () => ({
      set: (updates: unknown) => {
        mockSet(updates);
        return {
          where: () => ({
            returning: jest.fn().mockResolvedValue([{
              ...member,
              ...(updates as object),
              createdAt: new Date('2026-01-01T00:00:00Z'),
            }]),
          }),
        };
      },
    }),
  },
}));

jest.mock('@/lib/db/schema', () => ({
  users: { id: 'id', name: 'name', pin: 'pin', pinLength: 'pinLength', pinKind: 'pinKind' },
  calendarGroups: { userId: 'userId', type: 'type' },
}));

const mockRequireAuth = jest.fn();
jest.mock('@/lib/auth', () => ({
  requireAuth: () => mockRequireAuth(),
  requireRole: jest.fn().mockReturnValue(null),
}));

jest.mock('@/lib/cache/cacheKeys', () => ({ invalidateEntity: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/services/auditLog', () => ({ logActivity: jest.fn() }));
jest.mock('@/lib/setup', () => ({ isSetupComplete: jest.fn().mockResolvedValue(true) }));

const mockCompare = jest.fn();
jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: {
    hash: jest.fn().mockResolvedValue('$2b$new-hash'),
    compare: (...a: unknown[]) => mockCompare(...a),
  },
}));

const mockReserve = jest.fn();
const mockRecordFailed = jest.fn();
const mockClearAttempts = jest.fn();
const mockEndAll = jest.fn();
const mockEndOthers = jest.fn();
jest.mock('@/lib/auth/session', () => ({
  reserveLoginAttempt: (...a: unknown[]) => mockReserve(...a),
  recordFailedLogin: (...a: unknown[]) => mockRecordFailed(...a),
  clearLoginAttempts: (...a: unknown[]) => mockClearAttempts(...a),
  invalidateAllUserSessions: (...a: unknown[]) => mockEndAll(...a),
  revokeOtherSessions: (...a: unknown[]) => mockEndOthers(...a),
}));
jest.mock('next/headers', () => ({
  cookies: async () => ({ get: (k: string) => (k === 'prism_session' ? { value: 'token-this-device' } : undefined) }),
}));

import { PATCH } from '../[id]/route';

const member = { id: 'child-1', name: 'Sam', role: 'child', color: '#3B82F6', email: null, avatarUrl: null, pin: '$2a$old-hash', pinLength: 4, pinKind: 'digits' };

function patch(body: Record<string, unknown>) {
  const req = new NextRequest('http://localhost:3000/api/family/child-1', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return PATCH(req, { params: Promise.resolve({ id: 'child-1' }) });
}

beforeEach(() => {
  mockReserve.mockResolvedValue({ allowed: true, count: 1 });
  mockRecordFailed.mockResolvedValue({ remainingAttempts: 4 });
});

describe('PATCH /api/family/[id] PIN length', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ userId: 'parent-1', role: 'parent' });
    mockWhere.mockResolvedValue([member]);
    mockCompare.mockResolvedValue(true);
  });

  it('refuses a new length without a new PIN when the member has one', async () => {
    const res = await patch({ pinLength: 6 });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/new 6-digit PIN/);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('saves the length and the new PIN together', async () => {
    const res = await patch({ pinLength: 6, pin: '123456', currentPin: '1234' });
    expect(res.status).toBe(200);
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ pinLength: 6, pin: '$2b$new-hash' }));
  });

  it('keeps everything when the current PIN is wrong', async () => {
    // A co-parent: the one case where another member's current PIN is still needed.
    mockWhere.mockResolvedValue([{ ...member, role: 'parent' }]);
    mockCompare.mockResolvedValue(false);
    const res = await patch({ pinLength: 6, pin: '123456', currentPin: '9999' });
    expect(res.status).toBe(401);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('refuses a new PIN of the old length', async () => {
    const res = await patch({ pinLength: 6, pin: '1234', currentPin: '1234' });
    expect(res.status).toBe(400);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('allows a new length with the PIN removed', async () => {
    const res = await patch({ pinLength: 6, pin: null, currentPin: '1234' });
    expect(res.status).toBe(200);
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ pinLength: 6, pin: null }));
  });

  it('allows a new length for a member with no PIN', async () => {
    mockWhere.mockResolvedValue([{ ...member, pin: null }]);
    const res = await patch({ pinLength: 6 });
    expect(res.status).toBe(200);
  });

  it('allows an edit that resends the unchanged length', async () => {
    const res = await patch({ pinLength: 4 });
    expect(res.status).toBe(200);
  });
});

describe('PATCH /api/family/[id] parent PIN reset', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ userId: 'parent-1', role: 'parent' });
    mockWhere.mockResolvedValue([member]);
    mockCompare.mockResolvedValue(false);
  });

  it("lets a parent set a child's PIN without the current one", async () => {
    const res = await patch({ pin: '5678' });
    expect(res.status).toBe(200);
    expect(mockCompare).not.toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ pin: '$2b$new-hash' }));
  });

  it("lets a parent set a guest's PIN and length without the current one", async () => {
    mockWhere.mockResolvedValue([{ ...member, role: 'guest' }]);
    const res = await patch({ pinLength: 6, pin: '567890' });
    expect(res.status).toBe(200);
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ pinLength: 6 }));
  });

  it("still needs a co-parent's current PIN", async () => {
    mockWhere.mockResolvedValue([{ ...member, role: 'parent' }]);
    const res = await patch({ pin: '5678' });
    expect(res.status).toBe(400);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("still needs a parent's own current PIN", async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'child-1', role: 'parent' });
    mockWhere.mockResolvedValue([{ ...member, role: 'parent' }]);
    const res = await patch({ pin: '5678' });
    expect(res.status).toBe(400);
  });

  it('never lets an API token skip the current PIN', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'parent-1', role: 'parent', scopes: ['*'] });
    const res = await patch({ pin: '5678' });
    expect(res.status).toBe(400);
    expect(mockSet).not.toHaveBeenCalled();
  });
});

// #1197: a member can sign in with a passcode of letters and numbers.
describe('PATCH /api/family/[id] passcodes', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bcrypt = require('bcryptjs').default as { hash: jest.Mock };
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ userId: 'parent-1', role: 'parent' });
    mockWhere.mockResolvedValue([member]);
    mockCompare.mockResolvedValue(true);
  });

  it('switches a member to an 8-character passcode with a new one, hashed in lowercase', async () => {
    const res = await patch({ pinKind: 'passcode', pinLength: 8, pin: 'Maple22B' });
    expect(res.status).toBe(200);
    expect(bcrypt.hash).toHaveBeenCalledWith('maple22b', 12);
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ pinKind: 'passcode', pinLength: 8, pin: '$2b$new-hash' }));
    expect((await res.json()).pinKind).toBe('passcode');
  });

  it('refuses a passcode with anything but letters and numbers', async () => {
    const res = await patch({ pinKind: 'passcode', pinLength: 8, pin: 'maple-22' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Passcode must be exactly 8 letters or numbers');
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('refuses a passcode length outside 6 to 12, and a PIN longer than 6', async () => {
    expect((await patch({ pinKind: 'passcode', pinLength: 5, pin: 'abcde' })).status).toBe(400);
    expect((await patch({ pinKind: 'passcode', pinLength: 14, pin: 'abcdefghijklmn' })).status).toBe(400);
    expect((await patch({ pinLength: 8, pin: '12345678' })).status).toBe(400);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('refuses a new kind without a new credential when the member has one', async () => {
    const res = await patch({ pinKind: 'passcode', pinLength: 6 });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/needs a new passcode/);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('keeps a PIN to digits', async () => {
    expect((await patch({ pin: 'ab12' })).status).toBe(400);
    expect((await patch({ pin: '4321' })).status).toBe(200);
  });

  it('refuses a kind it does not know', async () => {
    expect((await patch({ pinKind: 'password' })).status).toBe(400);
  });
});

// #1221: a wrong current PIN counts against the member's sign-in lockout.
describe('PATCH /api/family/[id] current PIN attempts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ userId: 'parent-1', role: 'parent' });
    // A co-parent: the case where another member's current PIN is checked.
    mockWhere.mockResolvedValue([{ ...member, role: 'parent' }]);
    mockReserve.mockResolvedValue({ allowed: true, count: 3 });
    mockRecordFailed.mockResolvedValue({ remainingAttempts: 2 });
  });

  it('counts a wrong current PIN against that member', async () => {
    mockCompare.mockResolvedValue(false);
    const res = await patch({ pin: '5678', currentPin: '0000' });
    expect(res.status).toBe(401);
    expect(mockReserve).toHaveBeenCalledWith('child-1');
    expect(mockRecordFailed).toHaveBeenCalledWith('child-1', 3);
    expect((await res.json()).remainingAttempts).toBe(2);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('refuses without checking while the member is locked out', async () => {
    mockReserve.mockResolvedValue({ allowed: false, retryAfter: 240 });
    mockCompare.mockResolvedValue(true);
    const res = await patch({ pin: '5678', currentPin: '1234' });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual(expect.objectContaining({ lockedOut: true, retryAfter: 240 }));
    expect(mockCompare).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('clears the count on the right PIN, as signing in does', async () => {
    mockCompare.mockResolvedValue(true);
    const res = await patch({ pin: '5678', currentPin: '1234' });
    expect(res.status).toBe(200);
    expect(mockClearAttempts).toHaveBeenCalledWith('child-1');
    expect(mockRecordFailed).not.toHaveBeenCalled();
  });

  it('compares a current passcode in lower case', async () => {
    mockWhere.mockResolvedValue([{ ...member, role: 'parent', pinKind: 'passcode', pinLength: 8 }]);
    mockCompare.mockResolvedValue(true);
    const res = await patch({ pin: 'birch33c', currentPin: 'Maple22B' });
    expect(res.status).toBe(200);
    expect(mockCompare).toHaveBeenCalledWith('maple22b', '$2a$old-hash');
  });
});

// #1221: a new PIN, a new role or removal signs the member's devices out.
describe('PATCH /api/family/[id] ends sessions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ userId: 'parent-1', role: 'parent' });
    mockWhere.mockResolvedValue([member]);
    mockCompare.mockResolvedValue(true);
  });

  it("ends every session of a member whose PIN a parent changed", async () => {
    expect((await patch({ pin: '5678' })).status).toBe(200);
    expect(mockEndAll).toHaveBeenCalledWith('child-1');
    expect(mockEndOthers).not.toHaveBeenCalled();
  });

  it('ends every session when the PIN is removed', async () => {
    expect((await patch({ pin: null })).status).toBe(200);
    expect(mockEndAll).toHaveBeenCalledWith('child-1');
  });

  it("ends every session of a member whose role changed", async () => {
    expect((await patch({ role: 'guest' })).status).toBe(200);
    expect(mockEndAll).toHaveBeenCalledWith('child-1');
  });

  it('keeps this device when a member changes their own PIN, and ends the others', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'child-1', role: 'parent' });
    mockWhere.mockResolvedValue([{ ...member, role: 'parent' }]);
    expect((await patch({ pin: '5678', currentPin: '1234' })).status).toBe(200);
    expect(mockEndOthers).toHaveBeenCalledWith('child-1', 'token-this-device');
    expect(mockEndAll).not.toHaveBeenCalled();
  });

  it('an API token changing a PIN keeps no session', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'child-1', role: 'parent', scopes: ['*'] });
    mockWhere.mockResolvedValue([{ ...member, role: 'parent' }]);
    expect((await patch({ pin: '5678', currentPin: '1234' })).status).toBe(200);
    expect(mockEndAll).toHaveBeenCalledWith('child-1');
  });

  it('leaves sessions alone for a name, colour or unchanged role', async () => {
    expect((await patch({ name: 'Sammy', color: '#10B981', role: 'child' })).status).toBe(200);
    expect(mockEndAll).not.toHaveBeenCalled();
    expect(mockEndOthers).not.toHaveBeenCalled();
  });
});
