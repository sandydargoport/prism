/**
 * Recipe edits going back (#1207), at the routes: the review offers a recipe
 * deleted in Prism unticked and says what ticking it does; nothing is sent to
 * a server whose token only reads; and after a sync the recipe ids Prism holds
 * are kept, so the next sync can tell a recipe deleted in Prism.
 */
const mockRequireAuth = jest.fn();
const mockSelectWhere = jest.fn();
const mockUpdateSet = jest.fn();
const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
const mockPreview = jest.fn();
const mockPushUpdate = jest.fn();
const mockRecipeIds = jest.fn();

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
  getRedisClient: () => Promise.resolve({
    get: (...a: unknown[]) => mockRedisGet(...a),
    setEx: (...a: unknown[]) => mockRedisSet(...a),
    del: jest.fn(),
  }),
}));
jest.mock('@/lib/cache/cacheKeys', () => ({ invalidateEntity: jest.fn() }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));
jest.mock('@/lib/sync/adapters/recipeWriter', () => ({ syncedRecipeIds: (...a: unknown[]) => mockRecipeIds(...a) }));
jest.mock('@/lib/sync/runner', () => ({
  ...jest.requireActual('@/lib/sync/runner'),
  previewSync: (...a: unknown[]) => mockPreview(...a),
}));
jest.mock('@/lib/sync/adapters/registry', () => ({
  getRecipeAdapter: () => ({
    entityType: 'recipe',
    applyAdd: jest.fn(),
    applyUpdate: jest.fn(),
    applyDelete: jest.fn(),
    push: {
      loadCandidates: jest.fn(),
      pushAdd: jest.fn(),
      pushUpdate: (...a: unknown[]) => mockPushUpdate(...a),
      pushDelete: jest.fn(),
    },
  }),
}));

import { NextRequest } from 'next/server';
import { POST as PREVIEW } from '../[id]/sync/preview/route';
import { POST as APPLY } from '../[id]/sync/apply/route';

const ctx = { params: Promise.resolve({ id: 's1' }) };
const EDIT = { kind: 'push-update', externalId: '2', localId: 'l2', label: 'Pasta', reason: 'Changed in Prism', defaultChecked: true };
const DELETED = { kind: 'push-delete', externalId: '3', label: 'Old soup', reason: 'Removed in Prism', defaultChecked: false };

const apply = () => APPLY(
  new NextRequest('http://localhost/api/recipe-sources/s1/sync/apply', {
    method: 'POST',
    body: JSON.stringify({ diffId: 'd1', selected: [{ kind: 'push-update', externalId: '2' }] }),
  }),
  ctx,
);

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ userId: 'p1', role: 'parent' });
  mockRecipeIds.mockResolvedValue(['2', '5']);
});

it('asks for Prism edits only on a server that can write, and offers a deleted recipe unticked, saying what ticking does', async () => {
  mockSelectWhere.mockResolvedValue([{ id: 's1', provider: 'tandoor', lastSynced: null, providerConfig: { canWrite: true, recipeIds: ['2', '3'] } }]);
  mockPreview.mockResolvedValue({
    changes: [EDIT, DELETED],
    counts: { add: 0, update: 0, delete: 0 },
    pushCounts: { add: 0, update: 1, delete: 1 },
    massDeleteGuardTripped: false, withheldDeletes: 0, pushDeleteGuardTripped: false, withheldPushDeletes: 0,
  });
  const body = await (await PREVIEW(new NextRequest('http://localhost/x', { method: 'POST' }), ctx)).json();
  expect(mockPreview.mock.calls[0][2].push.knownExternalIds).toEqual(new Set(['2', '3']));
  const deleted = body.changes.find((c: { kind: string }) => c.kind === 'push-delete');
  expect(deleted.defaultChecked).toBe(false);
  expect(deleted.reason).toMatch(/stays in Tandoor unless ticked; ticking deletes it there too/);
  expect(body.pushCounts).toEqual({ add: 0, update: 1, delete: 1 });
});

it('does not ask for Prism edits on a server that only reads', async () => {
  mockSelectWhere.mockResolvedValue([{ id: 's1', provider: 'tandoor', lastSynced: null, providerConfig: { canWrite: false } }]);
  mockPreview.mockResolvedValue({ changes: [], counts: { add: 0, update: 0, delete: 0 }, pushCounts: { add: 0, update: 0, delete: 0 } });
  await PREVIEW(new NextRequest('http://localhost/x', { method: 'POST' }), ctx);
  expect(mockPreview.mock.calls[0][2].push).toBeUndefined();
});

it('sends nothing to a server whose token only reads', async () => {
  mockSelectWhere.mockResolvedValue([{ id: 's1', provider: 'tandoor', providerConfig: { canWrite: false } }]);
  mockRedisGet.mockResolvedValue(JSON.stringify([EDIT]));
  expect((await apply()).status).toBe(403);
  expect(mockPushUpdate).not.toHaveBeenCalled();
});

it('sends a ticked edit and keeps the recipe ids Prism now holds', async () => {
  mockSelectWhere.mockResolvedValue([{ id: 's1', provider: 'tandoor', providerConfig: { canWrite: true } }]);
  mockRedisGet.mockResolvedValue(JSON.stringify([EDIT]));
  const res = await apply();
  expect((await res.json()).sent).toEqual({ add: 0, update: 1, delete: 0 });
  expect(mockRecipeIds).toHaveBeenCalledWith('s1');
  expect(mockUpdateSet.mock.calls[0][0].providerConfig).toEqual({ canWrite: true, recipeIds: ['2', '5'] });
});
