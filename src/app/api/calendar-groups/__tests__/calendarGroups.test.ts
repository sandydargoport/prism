/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockDelete = jest.fn();
const mockUpdate = jest.fn();
const mockRequireAuth = jest.fn();

jest.mock('@/lib/db/client', () => ({
  db: {
    select: (...a: unknown[]) => mockSelect(...a),
    insert: (...a: unknown[]) => mockInsert(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
    update: (...a: unknown[]) => mockUpdate(...a),
  },
}));
jest.mock('@/lib/db/schema', () => ({
  calendarGroups: { id: 'id', name: 'name', type: 'type' },
  calendarSources: { groupId: 'groupId' },
  users: { name: 'name' },
}));
jest.mock('@/lib/auth', () => ({
  requireAuth: (...a: unknown[]) => mockRequireAuth(...a),
  getDisplayAuth: jest.fn(),
}));
jest.mock('@/lib/cache/redis', () => ({ getCached: jest.fn() }));
jest.mock('@/lib/cache/cacheKeys', () => ({ invalidateEntity: jest.fn() }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));
jest.mock('drizzle-orm', () => ({ eq: jest.fn(), asc: jest.fn(), sql: jest.fn() }));

import { POST } from '../route';
import { DELETE } from '../[id]/route';

function postReq(body: object) {
  return new NextRequest('http://localhost/api/calendar-groups', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/calendar-groups — name uniqueness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ userId: 'p1', role: 'parent' });
  });

  /** Both lookups (groups, then users) resolve via Promise.all. */
  function primeLookups(groupNames: string[], userNames: string[]) {
    mockSelect
      .mockReturnValueOnce({ from: () => groupNames.map((name) => ({ name })) })
      .mockReturnValueOnce({ from: () => userNames.map((name) => ({ name })) });
  }

  it('rejects a name that collides with an existing group (case-insensitive)', async () => {
    primeLookups(['Family'], ['Alex', 'Bella']);
    const res = await POST(postReq({ name: 'family' }));
    expect(res.status).toBe(409);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("rejects a name that collides with a family member's name", async () => {
    primeLookups([], ['Alex', 'Bella']);
    const res = await POST(postReq({ name: 'ALEX' }));
    expect(res.status).toBe(409);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('allows a genuinely new name', async () => {
    primeLookups(['Family'], ['Alex', 'Bella']);
    const values = jest.fn().mockReturnValue({ returning: () => [{ id: 'g9', name: 'Grandparents' }] });
    mockInsert.mockReturnValue({ values });
    const res = await POST(postReq({ name: 'Grandparents' }));
    expect(res.status).toBe(201);
    expect(values).toHaveBeenCalled();
  });
});

describe('DELETE /api/calendar-groups/[id] — system groups are protected', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ userId: 'p1', role: 'parent' });
  });

  function primeGroup(type: string) {
    mockSelect.mockReturnValueOnce({ from: () => ({ where: () => [{ id: 'g1', type }] }) });
  }
  const params = { params: Promise.resolve({ id: 'g1' }) };
  const req = new NextRequest('http://localhost/api/calendar-groups/g1', { method: 'DELETE' });

  it('refuses to delete a family (system) group', async () => {
    primeGroup('family');
    const res = await DELETE(req, params);
    expect(res.status).toBe(400);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('refuses to delete a member (user) group', async () => {
    primeGroup('user');
    const res = await DELETE(req, params);
    expect(res.status).toBe(400);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('allows deleting a user-created custom group', async () => {
    primeGroup('custom');
    mockUpdate.mockReturnValue({ set: () => ({ where: () => Promise.resolve(undefined) }) });
    mockDelete.mockReturnValue({ where: () => Promise.resolve(undefined) });
    const res = await DELETE(req, params);
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalled();
  });
});
