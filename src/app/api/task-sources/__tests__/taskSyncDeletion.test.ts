/**
 * What the reconciler does when tasks vanish from a provider.
 *
 * The behaviour under test is the one that used to destroy data: a task the
 * provider stops listing was deleted locally, with no review, no guard and no
 * undo. A provider returning an empty list — an outage, a revoked scope, the
 * wrong list id — took every synced task with it.
 *
 * These tests drive the real route with a mocked provider and database.
 */
const mockRequireAuth = jest.fn();
const mockRequireRole = jest.fn();
const mockFetchTasks = jest.fn();
const mockCreateTask = jest.fn();
const mockUpdateTask = jest.fn();

/** Every db write the route makes, in order, so we can assert on the shape. */
const writes: Array<{ op: string; payload?: unknown; table?: string }> = [];

/** True only for a delete against the tasks table. */
const deletedTasks = () => writes.some((w) => w.op === 'delete' && w.table === 'tasks');
let localRows: Array<Record<string, unknown>> = [];
let sourceRow: Record<string, unknown> = {};

const selectChain = () => {
  const thenable = {
    where: () => thenable,
    from: () => thenable,
    then: (resolve: (v: unknown) => void) => resolve(selectResult()),
  };
  return thenable;
};
let selectCall = 0;
function selectResult() {
  // First select is the task source, second is the local task set.
  selectCall += 1;
  return selectCall === 1 ? [sourceRow] : localRows;
}

jest.mock('@/lib/db/client', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => Promise.resolve(selectResult()) }) }),
    update: () => ({
      set: (payload: unknown) => {
        writes.push({ op: 'update', payload });
        return { where: () => Promise.resolve() };
      },
    }),
    insert: () => ({
      values: (payload: unknown) => {
        writes.push({ op: 'insert', payload });
        return { onConflictDoNothing: () => Promise.resolve(), then: (r: (v: unknown) => void) => r(undefined) };
      },
    }),
    delete: (table: { __name?: string }) => ({
      where: () => {
        // Record WHICH table. The route legitimately deletes spent tombstone
        // rows; deleting from `tasks` is the thing that must never happen.
        writes.push({ op: 'delete', table: table?.__name });
        return Promise.resolve();
      },
    }),
  },
}));
jest.mock('@/lib/db/schema', () => ({
  taskSources: { id: 'id' },
  tasks: { __name: 'tasks', id: 'id', taskSourceId: 'tsid', listId: 'lid', externalId: 'eid', syncExempt: 'se', pendingDeletion: 'pd' },
  dismissedTasks: { __name: 'dismissed_tasks', taskSourceId: 'tsid', externalTaskId: 'etid' },
}));
jest.mock('drizzle-orm', () => ({
  eq: jest.fn(), and: jest.fn(), or: jest.fn(), isNull: jest.fn(), isNotNull: jest.fn(), inArray: jest.fn(),
}));
jest.mock('@/lib/auth', () => ({
  requireAuth: (...a: unknown[]) => mockRequireAuth(...a),
  requireRole: (...a: unknown[]) => mockRequireRole(...a),
}));
jest.mock('@/lib/cache/cacheKeys', () => ({ invalidateEntity: jest.fn() }));
jest.mock('@/lib/services/auditLog', () => ({ logActivity: jest.fn() }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));
jest.mock('@/lib/utils/crypto', () => ({ decrypt: (v: string) => v, encrypt: (v: string) => v }));
jest.mock('@/lib/integrations/tasks', () => ({
  getTaskProvider: () => ({
    fetchTasks: (...a: unknown[]) => mockFetchTasks(...a),
    createTask: (...a: unknown[]) => mockCreateTask(...a),
    updateTask: (...a: unknown[]) => mockUpdateTask(...a),
  }),
}));

import { NextRequest } from 'next/server';
import { POST } from '../[id]/sync/route';

const LONG_AGO = new Date(Date.now() - 60 * 60 * 1000);

function syncedRow(over: Record<string, unknown> = {}) {
  return {
    id: `local-${over.externalId ?? 'x'}`,
    title: 'A task',
    externalId: 'r1',
    taskSourceId: 'src-1',
    lastSynced: LONG_AGO,
    updatedAt: LONG_AGO,
    pendingDeletion: null,
    completed: false,
    ...over,
  };
}

function run() {
  return POST(
    new NextRequest('http://localhost/api/task-sources/src-1/sync', { method: 'POST' }),
    { params: Promise.resolve({ id: 'src-1' }) },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  writes.length = 0;
  selectCall = 0;
  mockRequireAuth.mockResolvedValue({ userId: 'p1', role: 'parent' });
  mockRequireRole.mockReturnValue(undefined);
  sourceRow = {
    id: 'src-1', provider: 'google_tasks', externalListId: 'list-1', taskListId: 'tl-1',
    syncEnabled: true, accessToken: 'at', refreshToken: 'rt', tokenExpiresAt: new Date(Date.now() + 3_600_000),
  };
  localRows = [];
  mockFetchTasks.mockResolvedValue([]);
});

describe('a task that vanished from the provider', () => {
  it('is flagged for review, not deleted', async () => {
    localRows = [syncedRow()];
    mockFetchTasks.mockResolvedValue([]);

    await run();

    expect(deletedTasks()).toBe(false);
    expect(writes).toContainEqual(
      expect.objectContaining({ op: 'update', payload: expect.objectContaining({ pendingDeletion: expect.any(Date) }) }),
    );
  });

  it('is not flagged while it is still too fresh to trust', async () => {
    // Just pushed upstream; the provider may not list it yet. Flagging here
    // would tell the user their own new task had been deleted.
    localRows = [syncedRow({ lastSynced: new Date() })];
    mockFetchTasks.mockResolvedValue([]);

    await run();

    expect(deletedTasks()).toBe(false);
    const flagged = writes.filter(
      (w) => w.op === 'update' && (w.payload as Record<string, unknown>)?.pendingDeletion instanceof Date,
    );
    expect(flagged).toHaveLength(0);
  });

  it('is left alone entirely when the whole list disappears', async () => {
    // The failure this feature exists for. Nothing is flagged and nothing is
    // deleted; the run reports the problem instead.
    localRows = Array.from({ length: 30 }, (_, i) => syncedRow({ externalId: `r${i}`, id: `local-${i}` }));
    mockFetchTasks.mockResolvedValue([]);

    const res = await run();
    const body = await res.json();

    expect(deletedTasks()).toBe(false);
    const flagged = writes.filter(
      (w) => w.op === 'update' && (w.payload as Record<string, unknown>)?.pendingDeletion instanceof Date,
    );
    expect(flagged).toHaveLength(0);
    expect(JSON.stringify(body)).toMatch(/missing from the provider/i);
  });
});

describe('a task belonging to something else', () => {
  it('is not flagged just because this provider has never heard of it', async () => {
    // CalDAV task rows, and orphans left by ON DELETE SET NULL, sit in the
    // same list with no source. They used to be deleted by whichever provider
    // synced next.
    localRows = [syncedRow({ taskSourceId: null, externalId: 'caldav:other:123' })];
    mockFetchTasks.mockResolvedValue([]);

    await run();

    expect(deletedTasks()).toBe(false);
    const flagged = writes.filter(
      (w) => w.op === 'update' && (w.payload as Record<string, unknown>)?.pendingDeletion instanceof Date,
    );
    expect(flagged).toHaveLength(0);
  });
});

describe('a task the provider is listing again', () => {
  it('has its flag cleared, so one bad response heals itself', async () => {
    localRows = [syncedRow({ pendingDeletion: LONG_AGO })];
    mockFetchTasks.mockResolvedValue([
      { id: 'r1', title: 'A task', completed: false, updatedAt: LONG_AGO, dueDate: null, description: null, priority: null, completedAt: null },
    ]);

    await run();

    expect(writes).toContainEqual(
      expect.objectContaining({ op: 'update', payload: expect.objectContaining({ pendingDeletion: null }) }),
    );
  });
});
