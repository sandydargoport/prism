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
  users: { id: 'id', name: 'name', pin: 'pin', pinLength: 'pinLength' },
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

import { PATCH } from '../[id]/route';

const member = { id: 'child-1', name: 'Sam', role: 'child', color: '#3B82F6', email: null, avatarUrl: null, pin: '$2a$old-hash', pinLength: 4 };

function patch(body: Record<string, unknown>) {
  const req = new NextRequest('http://localhost:3000/api/family/child-1', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return PATCH(req, { params: Promise.resolve({ id: 'child-1' }) });
}

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
