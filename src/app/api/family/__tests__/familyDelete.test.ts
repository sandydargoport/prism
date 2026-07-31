/**
 * Tests for family member deletion endpoint.
 *
 * Mocks DB, auth, and cache to test:
 * - Successful deletion of a child
 * - Successful deletion of a parent (when others remain)
 * - Last parent protection (cannot delete)
 * - Non-parent cannot delete
 * - Nonexistent member returns 404
 */

import { NextRequest, NextResponse } from 'next/server';

// --- DB mock ---
const mockSelect = jest.fn();
const mockFrom = jest.fn();
const mockWhere = jest.fn();
const mockDelete = jest.fn();
const mockTransaction = jest.fn();

mockSelect.mockReturnValue({ from: mockFrom });
mockFrom.mockReturnValue({ where: mockWhere });
mockDelete.mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) });

jest.mock('@/lib/db/client', () => ({
  db: {
    select: (...a: unknown[]) => mockSelect(...a),
    transaction: (...a: unknown[]) => mockTransaction(...a),
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        catch: jest.fn(),
      }),
    }),
  },
}));

jest.mock('@/lib/db/schema', () => ({
  users: { id: 'id', name: 'name', role: 'role', color: 'color', email: 'email', avatarUrl: 'avatarUrl', pin: 'pin', createdAt: 'createdAt' },
  calendarGroups: { userId: 'userId', color: 'color' },
  settings: { key: 'key', value: 'value' },
}));

// --- Auth mock ---
const mockRequireAuth = jest.fn();
const mockRequireRole = jest.fn();

jest.mock('@/lib/auth', () => ({
  requireAuth: () => mockRequireAuth(),
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

// --- Cache mock ---
jest.mock('@/lib/cache/redis', () => ({
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/cache/rateLimit', () => ({
  rateLimitGuard: jest.fn().mockResolvedValue(null),
}));

// --- bcrypt mock ---
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2a$hashed'),
  compare: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/lib/setup', () => ({
  isSetupComplete: jest.fn(),
}));

import { DELETE } from '../[id]/route';
import { isSetupComplete } from '@/lib/setup';

const mockIsSetupComplete = isSetupComplete as jest.Mock;

const parentAuth = { userId: 'parent-1', role: 'parent' };

describe('DELETE /api/family/[id]', () => {
  const routeParams = { params: Promise.resolve({ id: 'child-1' }) };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue(parentAuth);
    mockRequireRole.mockReturnValue(null); // allowed
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockIsSetupComplete.mockResolvedValue(true);
  });

  it('deletes a child member successfully', async () => {
    // Lookup: member exists and is a child
    mockWhere.mockResolvedValueOnce([{
      id: 'child-1', name: 'Timmy', role: 'child',
    }]);

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        delete: () => ({ where: jest.fn().mockResolvedValue(undefined) }),
      });
    });

    const req = new NextRequest('http://localhost:3000/api/family/child-1', { method: 'DELETE' });
    const res = await DELETE(req, routeParams);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('deletes a parent when other parents remain', async () => {
    const params = { params: Promise.resolve({ id: 'parent-2' }) };
    // Lookup: member is a parent
    mockWhere.mockResolvedValueOnce([{
      id: 'parent-2', name: 'Mom', role: 'parent',
    }]);

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const txMock = {
        select: () => ({ from: () => ({ where: jest.fn().mockResolvedValue([
          { count: 'parent-1' },
          { count: 'parent-2' },
        ]) }) }),
        delete: () => ({ where: jest.fn().mockResolvedValue(undefined) }),
      };
      return fn(txMock);
    });

    const req = new NextRequest('http://localhost:3000/api/family/parent-2', { method: 'DELETE' });
    const res = await DELETE(req, params);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('prevents deletion of the last parent', async () => {
    const params = { params: Promise.resolve({ id: 'parent-1' }) };
    // Lookup: member is a parent
    mockWhere.mockResolvedValueOnce([{
      id: 'parent-1', name: 'Dad', role: 'parent',
    }]);

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const txMock = {
        select: () => ({ from: () => ({ where: jest.fn().mockResolvedValue([
          { count: 'parent-1' }, // only one parent
        ]) }) }),
        delete: () => ({ where: jest.fn().mockResolvedValue(undefined) }),
      };
      return fn(txMock);
    });

    const req = new NextRequest('http://localhost:3000/api/family/parent-1', { method: 'DELETE' });
    const res = await DELETE(req, params);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('Cannot delete the last parent');
  });

  it('returns 404 when member does not exist', async () => {
    mockWhere.mockResolvedValueOnce([]); // no member found

    const req = new NextRequest('http://localhost:3000/api/family/nonexistent', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: 'nonexistent' }) });

    expect(res.status).toBe(404);
  });

  it('returns 403 when non-parent tries to delete', async () => {
    mockRequireRole.mockReturnValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    );

    const req = new NextRequest('http://localhost:3000/api/family/child-1', { method: 'DELETE' });
    const res = await DELETE(req, routeParams);

    expect(res.status).toBe(403);
  });

  it('returns 401 when not authenticated (setup already complete)', async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    );
    // Route checks for an unauthenticated setup-bootstrap exception before
    // enforcing this 401 — simulate setup already being complete so that
    // exception doesn't apply and the 401 stands.
    mockIsSetupComplete.mockResolvedValue(true);

    const req = new NextRequest('http://localhost:3000/api/family/child-1', { method: 'DELETE' });
    const res = await DELETE(req, routeParams);

    expect(res.status).toBe(401);
  });

  it('allows unauthenticated deletion during setup bootstrap (setup not complete)', async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    );
    // setup not complete -> unauthenticated bootstrap deletion allowed
    mockIsSetupComplete.mockResolvedValue(false);
    // Member lookup
    mockWhere.mockResolvedValueOnce([{ id: 'child-1', name: 'Timmy', role: 'child' }]);

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        delete: () => ({ where: jest.fn().mockResolvedValue(undefined) }),
      });
    });

    const req = new NextRequest('http://localhost:3000/api/family/child-1', { method: 'DELETE' });
    const res = await DELETE(req, routeParams);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
