/**
 * Dashboards are for parents (#1223): making, changing and deleting one needs
 * the settings right, as choosing what a screen shows does. The upgrade's
 * carry-over, which only fills an empty slot, stays open to any session.
 */
const mockAuth = jest.fn();
const mockUpdateSet = jest.fn();
const mockInsert = jest.fn();
const mockDelete = jest.fn();

jest.mock('@/lib/auth', () => {
  const { NextResponse } = jest.requireActual('next/server');
  const { PERMISSIONS } = jest.requireActual('@/types/user');
  return {
    requireAuth: () => mockAuth(),
    getDisplayAuth: () => mockAuth(),
    requireRole: (auth: { role: keyof typeof PERMISSIONS; scopes?: string[] }, p: string) => {
      const ok = auth.scopes ? auth.scopes.includes('*') || auth.scopes.includes(p) : PERMISSIONS[auth.role][p];
      return ok ? null : NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    },
  };
});
jest.mock('@/lib/db/client', () => {
  const row = { id: 'l1', name: 'Kitchen', slug: 'kitchen', view: null, isDefault: false, widgets: [] };
  const rows = [row, { ...row, id: 'l2', slug: 'hall' }];
  const chain: Record<string, unknown> = {};
  Object.assign(chain, {
    from: () => chain, where: () => chain, orderBy: () => chain, limit: () => Promise.resolve(rows),
    then: (r: (v: unknown) => unknown) => Promise.resolve(rows).then(r),
  });
  return {
    db: {
      select: () => chain,
      update: () => ({ set: (v: unknown) => { mockUpdateSet(v); return { where: () => ({ returning: () => Promise.resolve([row]), then: (r: (v: unknown) => unknown) => Promise.resolve().then(r) }) }; } }),
      insert: () => ({ values: (v: unknown) => { mockInsert(v); return { returning: () => Promise.resolve([row]) }; } }),
      delete: () => ({ where: () => { mockDelete(); return { returning: () => Promise.resolve([row]), then: (r: (v: unknown) => unknown) => Promise.resolve().then(r) }; } }),
      transaction: async (fn: (tx: unknown) => unknown) => fn({
        update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
        insert: () => ({ values: (v: unknown) => { mockInsert(v); return { returning: () => Promise.resolve([row]) }; } }),
      }),
    },
  };
});
jest.mock('@/lib/cache/cacheKeys', () => ({ invalidateEntity: jest.fn() }));
jest.mock('@/lib/services/auditLog', () => ({ logActivity: jest.fn() }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));

import { NextRequest } from 'next/server';
import { POST } from '../route';
import { PATCH, DELETE } from '../[id]/route';
import { POST as MAKE_DEFAULT } from '../[id]/default/route';

const params = { params: Promise.resolve({ id: 'l1' }) };
const req = (method: string, body?: unknown) =>
  new NextRequest('http://localhost/api/layouts/l1', { method, body: body === undefined ? undefined : JSON.stringify(body) });

const child = { userId: 'c1', role: 'child' };
const parent = { userId: 'p1', role: 'parent' };
const voiceToken = { userId: 'p1', role: 'parent', scopes: ['voice'] };

beforeEach(() => jest.clearAllMocks());

describe.each([
  ['a child', child],
  ['a token without the settings scope', voiceToken],
])('%s', (_name, who) => {
  beforeEach(() => mockAuth.mockResolvedValue(who));

  it('cannot make a dashboard', async () => {
    expect((await POST(req('POST', { name: 'Mine', widgets: [] }))).status).toBe(403);
    expect(mockInsert).not.toHaveBeenCalled();
  });
  it('cannot change one', async () => {
    expect((await PATCH(req('PATCH', { name: 'Renamed' }), params)).status).toBe(403);
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });
  it('cannot delete one', async () => {
    expect((await DELETE(req('DELETE'), params)).status).toBe(403);
    expect(mockDelete).not.toHaveBeenCalled();
  });
  it('cannot make one the default', async () => {
    expect((await MAKE_DEFAULT(req('POST'), params)).status).toBe(403);
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });
  it('can still hand over the upgrade carry-over', async () => {
    const res = await PATCH(req('PATCH', { carryOver: true, screensaverWidgets: [] }), params);
    expect(res.status).toBe(200);
    expect(mockUpdateSet).toHaveBeenCalled();
  });
});

describe('a parent', () => {
  beforeEach(() => mockAuth.mockResolvedValue(parent));
  it('can change a dashboard', async () => {
    expect((await PATCH(req("PATCH", { name: "Renamed" }), params)).status).toBe(200);
  });
  it('can delete one', async () => {
    expect((await DELETE(req("DELETE"), params)).status).toBe(200);
  });
});
