/**
 * Disconnecting Microsoft shows at once (#1226): the task and shopping source
 * lists are cached, and so are the task and shopping lists that show which
 * items are linked, so a disconnect drops all four.
 */
const mockAuth = jest.fn();
const mockInvalidate = jest.fn();

jest.mock('@/lib/auth', () => ({
  requireAuth: () => mockAuth(),
  requireRole: (auth: { role: string }) => {
    if (auth.role === 'parent') return null;
    const { NextResponse } = jest.requireActual('next/server');
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  },
}));
jest.mock('@/lib/cache/cacheKeys', () => ({
  invalidateEntity: (e: unknown) => mockInvalidate(e),
  invalidateEntities: (...a: unknown[]) => a.forEach((e) => mockInvalidate(e)),
}));
jest.mock('@/lib/services/auditLog', () => ({ logActivity: jest.fn() }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));
jest.mock('@/lib/db/schema', () => ({ taskSources: { provider: 'p' }, shoppingListSources: { provider: 'p' } }));
jest.mock('drizzle-orm', () => ({ eq: () => ({}) }));
jest.mock('@/lib/db/client', () => ({ db: { delete: () => ({ where: () => Promise.resolve() }) } }));

import { POST } from '../route';

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue({ userId: 'u1', role: 'parent' });
});

describe('POST /api/integrations/microsoft/disconnect', () => {
  it('drops the cached task and shopping lists and their sources', async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    for (const entity of ['task-sources', 'tasks', 'shopping-list-sources', 'shopping-lists']) {
      expect(mockInvalidate).toHaveBeenCalledWith(entity);
    }
  });

  it('drops nothing when the disconnect is refused', async () => {
    mockAuth.mockResolvedValue({ userId: 'u2', role: 'child' });
    expect((await POST()).status).toBe(403);
    expect(mockInvalidate).not.toHaveBeenCalled();
  });
});
