/**
 * Applying a meal-plan sync that sends changes back (#1206): nothing is sent
 * to a server whose token only reads, and after a sync the entry ids Prism
 * holds are kept, so the next sync can tell a meal removed in Prism from one
 * new in the source.
 */
const mockRequireAuth = jest.fn();
const mockSelectWhere = jest.fn();
const mockUpdateSet = jest.fn();
const mockRedisGet = jest.fn();
const mockPushDelete = jest.fn();
const mockEntryIds = jest.fn();

jest.mock('@/lib/auth', () => ({
  requireAuth: (...a: unknown[]) => mockRequireAuth(...a),
  requireRole: jest.requireActual('@/lib/auth/requireAuth').requireRole,
}));
jest.mock('@/lib/db/client', () => ({
  db: {
    select: () => ({ from: () => ({ where: (...a: unknown[]) => mockSelectWhere(...a) }) }),
    update: () => ({
      set: (v: unknown) => {
        mockUpdateSet(v);
        return { where: () => Promise.resolve() };
      },
    }),
  },
}));
jest.mock('@/lib/cache/rateLimit', () => ({ rateLimitGuard: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/cache/getRedisClient', () => ({
  getRedisClient: () => Promise.resolve({ get: (...a: unknown[]) => mockRedisGet(...a), del: jest.fn() }),
}));
jest.mock('@/lib/cache/cacheKeys', () => ({ invalidateEntity: jest.fn() }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));
jest.mock('@/lib/sync/adapters/mealWriter', () => ({ syncedMealEntryIds: (...a: unknown[]) => mockEntryIds(...a) }));
jest.mock('@/lib/sync/adapters/registry', () => ({
  getMealPlanAdapter: () => ({
    entityType: 'meal',
    applyAdd: jest.fn(),
    applyUpdate: jest.fn(),
    applyDelete: jest.fn(),
    push: {
      loadCandidates: jest.fn(),
      pushAdd: jest.fn(),
      pushUpdate: jest.fn(),
      pushDelete: (...a: unknown[]) => mockPushDelete(...a),
    },
  }),
}));

import { NextRequest } from 'next/server';
import { POST } from '../[id]/meal-sync/apply/route';

const REMOVAL = { kind: 'push-delete', externalId: '41', label: 'Soup — friday dinner', reason: 'Removed in Prism', defaultChecked: false };

const apply = () => POST(
  new NextRequest('http://localhost/api/recipe-sources/s1/meal-sync/apply', {
    method: 'POST',
    body: JSON.stringify({ diffId: 'd1', selected: [{ kind: 'push-delete', externalId: '41' }] }),
  }),
  { params: Promise.resolve({ id: 's1' }) },
);

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ userId: 'p1', role: 'parent' });
  mockRedisGet.mockResolvedValue(JSON.stringify([REMOVAL]));
  mockEntryIds.mockResolvedValue(['7', '8']);
});

it('sends nothing to a server whose token only reads', async () => {
  mockSelectWhere.mockResolvedValue([{ id: 's1', provider: 'tandoor', providerConfig: { canWrite: false } }]);
  const res = await apply();
  expect(res.status).toBe(403);
  expect(mockPushDelete).not.toHaveBeenCalled();
});

it('sends a ticked removal to a server that can write, and keeps the entry ids Prism now holds', async () => {
  mockSelectWhere.mockResolvedValue([{ id: 's1', provider: 'tandoor', providerConfig: { canWrite: true, writeCheckedAt: 'x' } }]);
  const res = await apply();
  expect(res.status).toBe(200);
  expect((await res.json()).sent).toEqual({ add: 0, update: 0, delete: 1 });
  expect(mockPushDelete).toHaveBeenCalledWith('s1', expect.objectContaining({ externalId: '41' }));
  expect(mockEntryIds).toHaveBeenCalledWith('tandoor');
  expect(mockUpdateSet.mock.calls[0][0].providerConfig).toEqual({ canWrite: true, writeCheckedAt: 'x', mealEntryIds: ['7', '8'] });
});
