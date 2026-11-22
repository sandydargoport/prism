/**
 * Unit tests for invalidateEntity() and invalidateEntities() in cacheKeys.ts.
 *
 * Cross-invalidation graph under test:
 *   chores        → points, goals
 *   tasks         → points
 *   wish-items    → wish-item-sources
 *   task-lists    → tasks, task-sources
 *   shopping-lists → shopping-list-sources
 *   calendar-groups → events
 *   family        → chores, tasks, events, messages
 *                    (chores → points, goals)
 *                    (tasks  → points)
 */

// Mock must be declared before importing the module under test.
const mockInvalidateCache = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/cache/redis', () => ({
  invalidateCache: (...args: unknown[]) => mockInvalidateCache(...args),
}));

import { invalidateEntity, invalidateEntities } from '../cacheKeys';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the set of cache-key patterns that were passed to invalidateCache. */
function calledPatterns(): string[] {
  return mockInvalidateCache.mock.calls.map((c) => c[0] as string);
}

/** Count how many times a specific pattern was passed to invalidateCache. */
function callCount(pattern: string): number {
  return mockInvalidateCache.mock.calls.filter((c) => c[0] === pattern).length;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// invalidateEntity — individual entities
// ---------------------------------------------------------------------------

describe('invalidateEntity', () => {
  it('chores: invalidates chores, points, and goals', async () => {
    await invalidateEntity('chores');

    const patterns = calledPatterns();
    expect(patterns).toContain('chores:*');
    expect(patterns).toContain('points:*');
    expect(patterns).toContain('goals:*');
  });

  it('chores: does not invalidate unrelated entities', async () => {
    await invalidateEntity('chores');

    const patterns = calledPatterns();
    expect(patterns).not.toContain('tasks:*');
    expect(patterns).not.toContain('family:*');
    expect(patterns).not.toContain('meals:*');
  });

  it('task-lists: invalidates task-lists, tasks, and task-sources', async () => {
    await invalidateEntity('task-lists');

    const patterns = calledPatterns();
    expect(patterns).toContain('task-lists:*');
    expect(patterns).toContain('tasks:*');
    expect(patterns).toContain('task-sources:*');
  });

  it('task-lists: tasks transitive dep (points) is also invalidated', async () => {
    await invalidateEntity('task-lists');

    // tasks → points
    const patterns = calledPatterns();
    expect(patterns).toContain('points:*');
  });

  it('meals: only invalidates meals (no cross-deps)', async () => {
    await invalidateEntity('meals');

    const patterns = calledPatterns();
    expect(patterns).toEqual(['meals:*']);
  });

  it('family: invalidates family, chores, tasks, points, goals', async () => {
    await invalidateEntity('family');

    const patterns = calledPatterns();
    expect(patterns).toContain('family:*');
    expect(patterns).toContain('chores:*');
    expect(patterns).toContain('tasks:*');
    expect(patterns).toContain('points:*');
    expect(patterns).toContain('goals:*');
  });

  // Events carry the member's colour and name, messages the author's (#1226).
  it('family: also invalidates events and messages', async () => {
    await invalidateEntity('family');

    const patterns = calledPatterns();
    expect(patterns).toContain('events:*');
    expect(patterns).toContain('messages:*');
  });

  // Events carry their calendar group's colour and name (#1226).
  it('calendar-groups: invalidates calendar-groups and events', async () => {
    await invalidateEntity('calendar-groups');

    expect(calledPatterns().sort()).toEqual(['calendar-groups:*', 'events:*']);
  });

  it('events: does not invalidate back up to calendar-groups or family', async () => {
    await invalidateEntity('events');

    expect(calledPatterns()).toEqual(['events:*']);
  });

  it('family: visited set prevents double-invalidation of chores and tasks', async () => {
    // family → chores → points, goals
    // family → tasks  → points
    // "points" is reachable via both chores and tasks; must only be called once.
    await invalidateEntity('family');

    expect(callCount('points:*')).toBe(1);
    expect(callCount('chores:*')).toBe(1);
    expect(callCount('tasks:*')).toBe(1);
    expect(callCount('goals:*')).toBe(1);
    expect(callCount('family:*')).toBe(1);
  });

  it('calling invalidateEntity with a fresh call each time uses an independent visited set', async () => {
    // Two separate top-level calls must each invalidate their own entity.
    await invalidateEntity('chores');
    await invalidateEntity('chores');

    // Each independent top-level call starts with a fresh visited set,
    // so chores:* is invalidated once per call.
    expect(callCount('chores:*')).toBe(2);
    expect(callCount('points:*')).toBe(2);
    expect(callCount('goals:*')).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// invalidateEntities — multiple entities, shared visited set
// ---------------------------------------------------------------------------

describe('invalidateEntities', () => {
  it('chores + tasks: points invalidated only once (shared visited set)', async () => {
    // chores → points, goals
    // tasks  → points
    // With a shared visited set, points is reached via chores first and
    // skipped when tasks tries to enqueue it.
    await invalidateEntities('chores', 'tasks');

    expect(callCount('points:*')).toBe(1);
  });

  it('chores + tasks: all expected keys are still invalidated', async () => {
    await invalidateEntities('chores', 'tasks');

    const patterns = calledPatterns();
    expect(patterns).toContain('chores:*');
    expect(patterns).toContain('tasks:*');
    expect(patterns).toContain('points:*');
    expect(patterns).toContain('goals:*');
  });

  it('invalidating the same entity twice via invalidateEntities does not double-call', async () => {
    await invalidateEntities('meals', 'meals');

    expect(callCount('meals:*')).toBe(1);
  });

  it('independent entities with no overlap each get their own invalidation', async () => {
    await invalidateEntities('meals', 'photos');

    expect(callCount('meals:*')).toBe(1);
    expect(callCount('photos:*')).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Circular / already-visited path prevention
// ---------------------------------------------------------------------------

describe('visited set prevents redundant invalidation', () => {
  it('family → chores → points and family → tasks → points: points called exactly once', async () => {
    await invalidateEntity('family');

    // Verify the exact call count for every entity reachable from family.
    expect(callCount('family:*')).toBe(1);
    expect(callCount('chores:*')).toBe(1);
    expect(callCount('tasks:*')).toBe(1);
    expect(callCount('points:*')).toBe(1);
    expect(callCount('goals:*')).toBe(1);
    expect(callCount('events:*')).toBe(1);
    expect(callCount('messages:*')).toBe(1);

    // Total unique patterns called should be exactly 7.
    const patterns = calledPatterns();
    expect(new Set(patterns).size).toBe(7);
  });

  it('task-lists → tasks → points: no duplicate points invalidation', async () => {
    await invalidateEntity('task-lists');

    expect(callCount('task-lists:*')).toBe(1);
    expect(callCount('tasks:*')).toBe(1);
    expect(callCount('task-sources:*')).toBe(1);
    expect(callCount('points:*')).toBe(1);

    const patterns = calledPatterns();
    expect(new Set(patterns).size).toBe(4);
  });
});
