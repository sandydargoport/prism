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
const mockRedisSet = jest.fn();
const mockPreview = jest.fn();

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
jest.mock('@/lib/sync/adapters/mealWriter', () => ({ syncedMealEntryIds: (...a: unknown[]) => mockEntryIds(...a) }));
jest.mock('@/lib/sync/runner', () => ({
  ...jest.requireActual('@/lib/sync/runner'),
  previewSync: (...a: unknown[]) => mockPreview(...a),
}));
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
import { POST as PREVIEW } from '../[id]/meal-sync/preview/route';

const REMOVAL = { kind: 'push-delete', externalId: '41', label: 'Soup — friday dinner', reason: 'Removed in Prism', defaultChecked: false };

/** A review as the preview stashes it: tied to its source and kind (#1225). */
const stash = (changes: unknown[], sourceId = 's1', kind = 'meal-plan') => JSON.stringify({ sourceId, kind, changes });

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
  mockRedisGet.mockResolvedValue(stash([REMOVAL]));
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

describe('a review applies only where it was made (#1225)', () => {
  beforeEach(() => {
    mockSelectWhere.mockResolvedValue([{ id: 's1', provider: 'tandoor', providerConfig: { canWrite: true } }]);
  });

  it('refuses a recipe review sent to the meal-plan route', async () => {
    mockRedisGet.mockResolvedValue(stash([REMOVAL], 's1', 'recipes'));
    const res = await apply();
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/prepared for recipes/);
    expect(mockPushDelete).not.toHaveBeenCalled();
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it('refuses a review made for another server', async () => {
    mockRedisGet.mockResolvedValue(stash([REMOVAL], 's2'));
    const res = await apply();
    expect(res.status).toBe(400);
    expect(mockPushDelete).not.toHaveBeenCalled();
  });

  it('treats a review stashed in the old shape as expired', async () => {
    mockRedisGet.mockResolvedValue(JSON.stringify([REMOVAL]));
    expect((await apply()).status).toBe(409);
    expect(mockPushDelete).not.toHaveBeenCalled();
  });
});

it('stashes the review with the source and kind it was made for (#1225)', async () => {
  mockSelectWhere.mockResolvedValue([{ id: 's1', provider: 'tandoor', lastSynced: null, providerConfig: { canWrite: true } }]);
  mockPreview.mockResolvedValue({
    changes: [REMOVAL],
    counts: { add: 0, update: 0, delete: 0 },
    pushCounts: { add: 0, update: 0, delete: 1 },
    massDeleteGuardTripped: false, withheldDeletes: 0, pushDeleteGuardTripped: false, withheldPushDeletes: 0,
  });
  const res = await PREVIEW(new NextRequest('http://localhost/x', { method: 'POST' }), { params: Promise.resolve({ id: 's1' }) });
  const body = await res.json();
  const [key, , stored] = mockRedisSet.mock.calls[0];
  expect(key).toBe(`sync-diff:${body.diffId}`);
  expect(JSON.parse(stored)).toEqual({ sourceId: 's1', kind: 'meal-plan', changes: [REMOVAL] });
});
