/**
 * An edited or deleted message shows at once (#1219): the message list is
 * cached, so editing or deleting a message drops the cached list, the same
 * way posting one does.
 */
const mockAuth = jest.fn();
const mockInvalidate = jest.fn();
const rows: Array<Record<string, unknown>> = [];

jest.mock('@/lib/auth', () => ({
  requireAuth: () => mockAuth(),
  requireRole: () => {
    const { NextResponse } = jest.requireActual('next/server');
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  },
}));
jest.mock('@/lib/cache/cacheKeys', () => ({ invalidateEntity: (...a: unknown[]) => mockInvalidate(...a) }));
jest.mock('@/lib/services/auditLog', () => ({ logActivity: jest.fn() }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));
jest.mock('@/lib/db/schema', () => ({ familyMessages: { id: 'id' }, users: { id: 'id' } }));
jest.mock('@/lib/messages/messageColumns', () => ({ messageWithAuthorColumns: {} }));
jest.mock('@/lib/utils/formatters', () => ({ formatMessageRow: (r: unknown) => r }));
jest.mock('drizzle-orm', () => ({ eq: () => ({}) }));
jest.mock('@/lib/db/client', () => {
  const where = () => Promise.resolve(rows);
  const chain = { from: () => chain, leftJoin: () => chain, where };
  return {
    db: {
      select: () => chain,
      update: () => ({ set: (v: Record<string, unknown>) => ({ where: () => { Object.assign(rows[0]!, v); return Promise.resolve(); } }) }),
      delete: () => ({ where: () => Promise.resolve() }),
    },
  };
});

import { NextRequest } from 'next/server';
import { PATCH, DELETE } from '../route';

const params = { params: Promise.resolve({ id: 'm1' }) };
const req = (method: string, body?: unknown) =>
  new NextRequest('http://localhost/api/messages/m1', { method, body: body === undefined ? undefined : JSON.stringify(body) });

beforeEach(() => {
  jest.clearAllMocks();
  rows.splice(0, rows.length, { id: 'm1', authorId: 'u1', message: 'Old text' });
  mockAuth.mockResolvedValue({ userId: 'u1', role: 'parent' });
});

describe('/api/messages/[id] drops the cached list', () => {
  it('after an edit', async () => {
    const res = await PATCH(req('PATCH', { message: 'New text' }), params);
    expect(res.status).toBe(200);
    expect(mockInvalidate).toHaveBeenCalledWith('messages');
  });

  it('after a delete', async () => {
    const res = await DELETE(req('DELETE'), params);
    expect(res.status).toBe(200);
    expect(mockInvalidate).toHaveBeenCalledWith('messages');
  });

  it('not when the change is refused', async () => {
    mockAuth.mockResolvedValue({ userId: 'u2', role: 'child' });
    expect((await PATCH(req('PATCH', { message: 'New text' }), params)).status).toBe(403);
    expect((await DELETE(req('DELETE'), params)).status).toBe(403);
    expect(mockInvalidate).not.toHaveBeenCalled();
  });
});
