/**
 * /api/pets (#996): list for the wall, add, rename and remove for a parent.
 * Removing a pet keeps its chores (the foreign key clears pet_id; checked
 * against a real database in e2e/chores-page.spec.ts).
 */
import { NextRequest, NextResponse } from 'next/server';

const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
jest.mock('@/lib/db/client', () => ({
  db: {
    select: (...a: unknown[]) => mockSelect(...a),
    insert: (...a: unknown[]) => mockInsert(...a),
    update: (...a: unknown[]) => mockUpdate(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
}));
jest.mock('@/lib/db/schema', () => ({ pets: { id: 'id', name: 'name', kind: 'kind', color: 'color', sortOrder: 'sortOrder', createdAt: 'createdAt' } }));
jest.mock('drizzle-orm', () => ({ eq: jest.fn(), asc: jest.fn(), max: jest.fn() }));

const mockGetDisplayAuth = jest.fn();
const mockRequireAuth = jest.fn();
const mockRequireRole = jest.fn();
jest.mock('@/lib/auth', () => ({
  getDisplayAuth: () => mockGetDisplayAuth(),
  requireAuth: () => mockRequireAuth(),
  requireRole: (...a: unknown[]) => mockRequireRole(...a),
}));
const mockInvalidate = jest.fn();
jest.mock('@/lib/cache/cacheKeys', () => ({ invalidateEntity: (...a: unknown[]) => mockInvalidate(...a) }));
jest.mock('@/lib/cache/rateLimit', () => ({ rateLimitGuard: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));

import { GET, POST } from '../route';
import { PATCH, DELETE } from '../[id]/route';

const req = (method: string, body?: object) => new NextRequest('http://localhost/api/pets', {
  method, body: body && JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
});
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const BISCUIT = { id: 'p1', name: 'Biscuit', kind: 'cat', color: '#3B82F6' };

beforeEach(() => {
  jest.clearAllMocks();
  mockGetDisplayAuth.mockResolvedValue({ userId: 'display' });
  mockRequireAuth.mockResolvedValue({ userId: 'parent-1', role: 'parent' });
  mockRequireRole.mockReturnValue(null);
});

describe('GET /api/pets', () => {
  it('lists the pets in order for the wall', async () => {
    mockSelect.mockReturnValue({ from: () => ({ orderBy: jest.fn().mockResolvedValue([BISCUIT]) }) });
    const res = await GET();
    expect(await res.json()).toEqual({ pets: [BISCUIT] });
  });

  it('lists nothing without a display session', async () => {
    mockGetDisplayAuth.mockResolvedValue(null);
    expect(await (await GET()).json()).toEqual({ pets: [] });
    expect(mockSelect).not.toHaveBeenCalled();
  });
});

describe('POST /api/pets', () => {
  it('adds a pet after the last one', async () => {
    mockSelect.mockReturnValue({ from: jest.fn().mockResolvedValue([{ n: 2 }]) });
    const values = jest.fn().mockReturnValue({ returning: jest.fn().mockResolvedValue([BISCUIT]) });
    mockInsert.mockReturnValue({ values });
    const res = await POST(req('POST', { name: ' Biscuit ', kind: 'cat', color: '#3B82F6' }));
    expect(res.status).toBe(201);
    expect(values).toHaveBeenCalledWith({ name: 'Biscuit', kind: 'cat', color: '#3B82F6', sortOrder: 3 });
  });

  it('refuses a pet with no name or a colour that is not #RRGGBB', async () => {
    expect((await POST(req('POST', { name: '', color: '#3B82F6' }))).status).toBe(400);
    expect((await POST(req('POST', { name: 'Biscuit', color: 'blue' }))).status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('is for someone who can manage chores', async () => {
    mockRequireRole.mockReturnValue(NextResponse.json({ error: 'Forbidden' }, { status: 403 }));
    expect((await POST(req('POST', { name: 'Biscuit', color: '#3B82F6' }))).status).toBe(403);
  });
});

describe('PATCH and DELETE /api/pets/[id]', () => {
  it('renames a pet and refreshes the chores that show it', async () => {
    const set = jest.fn().mockReturnValue({ where: () => ({ returning: jest.fn().mockResolvedValue([{ ...BISCUIT, name: 'Biscuit II' }]) }) });
    mockUpdate.mockReturnValue({ set });
    const res = await PATCH(req('PATCH', { name: 'Biscuit II' }), params('p1'));
    expect(res.status).toBe(200);
    expect(set).toHaveBeenCalledWith({ name: 'Biscuit II' });
    expect(mockInvalidate).toHaveBeenCalledWith('chores');
  });

  it('answers 404 for a pet that is not there', async () => {
    mockUpdate.mockReturnValue({ set: () => ({ where: () => ({ returning: jest.fn().mockResolvedValue([]) }) }) });
    expect((await PATCH(req('PATCH', { name: 'X' }), params('nope'))).status).toBe(404);
    mockDelete.mockReturnValue({ where: () => ({ returning: jest.fn().mockResolvedValue([]) }) });
    expect((await DELETE(req('DELETE'), params('nope'))).status).toBe(404);
  });

  it('removes a pet and refreshes the chores', async () => {
    mockDelete.mockReturnValue({ where: () => ({ returning: jest.fn().mockResolvedValue([{ id: 'p1' }]) }) });
    const res = await DELETE(req('DELETE'), params('p1'));
    expect(res.status).toBe(200);
    expect(mockInvalidate).toHaveBeenCalledWith('chores');
  });
});
