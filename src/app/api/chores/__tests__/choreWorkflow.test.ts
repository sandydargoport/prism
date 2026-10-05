/**
 * Tests for chore completion and approval workflow.
 *
 * Mocks DB, auth, cache, and validation to test the route handler logic:
 * - Parent auto-approval flow
 * - Child pending approval flow
 * - Disabled chore rejection
 * - Duplicate pending completion (409)
 * - Child cannot complete others' assigned chore
 * - Approval sets approvedBy/approvedAt and recalculates nextDue
 * - Non-parent cannot approve
 * - Approval of nonexistent chore/completion returns 404
 */

import { NextRequest, NextResponse } from 'next/server';

// --- Query result store: tests configure what each query returns ---
let queryResults: unknown[][] = [];
let queryIndex = 0;

function nextQueryResult() {
  const result = queryResults[queryIndex] ?? [];
  queryIndex++;
  return result;
}

// Chainable mock that returns the next result when the terminal method is awaited
function makeChain() {
  const chain: Record<string, unknown> = {};
  const proxy = new Proxy(chain, {
    get: (_target, prop) => {
      if (prop === 'then') {
        const p = Promise.resolve(nextQueryResult());
        return p.then.bind(p);
      }
      return (..._args: unknown[]) => proxy;
    },
  });
  return proxy;
}

const mockTxInsertReturning = jest.fn();
const mockTxUpdateWhere = jest.fn().mockResolvedValue(undefined);
const mockTransaction = jest.fn();

jest.mock('@/lib/db/client', () => ({
  db: new Proxy({}, {
    get: (_target, prop) => {
      if (prop === 'transaction') return (...a: unknown[]) => mockTransaction(...a);
      // select, insert, update all return the chainable proxy
      return () => makeChain();
    },
  }),
}));

jest.mock('@/lib/db/schema', () => ({
  chores: { id: 'id', title: 'title', pointValue: 'pointValue', requiresApproval: 'requiresApproval', enabled: 'enabled', frequency: 'frequency', customIntervalDays: 'customIntervalDays', startDay: 'startDay', assignedTo: 'assignedTo', lastCompleted: 'lastCompleted', nextDue: 'nextDue', updatedAt: 'updatedAt' },
  choreCompletions: { id: 'id', choreId: 'choreId', completedBy: 'completedBy', completedAt: 'completedAt', pointsAwarded: 'pointsAwarded', approvedBy: 'approvedBy', approvedAt: 'approvedAt', photoUrl: 'photoUrl', notes: 'notes' },
  users: { id: 'id', name: 'name', role: 'role', color: 'color' },
}));

jest.mock('drizzle-orm', () => ({
  eq: jest.fn(),
  and: jest.fn(),
  isNull: jest.fn(),
}));

// --- Auth mock ---
const mockRequireAuth = jest.fn();
const mockRequireRole = jest.fn();

jest.mock('@/lib/auth', () => ({
  requireAuth: () => mockRequireAuth(),
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

jest.mock('@/lib/cache/redis', () => ({
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/cache/rateLimit', () => ({
  rateLimitGuard: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/validations', () => ({
  completeChoreSchema: {},
  validateRequest: (_schema: unknown, data: unknown) => ({ success: true, data }),
}));

jest.mock('@/lib/utils/calculateNextDue', () => ({
  calculateNextDue: jest.fn().mockReturnValue('2026-03-01'),
}));

jest.mock('@/lib/householdTimezone', () => ({
  getHouseholdTimezone: jest.fn().mockResolvedValue('America/Chicago'),
}));

// Import routes after mocks
import { POST as completeChore } from '../[id]/complete/route';
import { POST as approveChore } from '../[id]/approve/route';
import { calculateNextDue } from '@/lib/utils/calculateNextDue';
import { todayKey } from '@/lib/utils/zonedDate';

// --- Helpers ---

const parentAuth = { userId: 'parent-1', role: 'parent' };
const childAuth = { userId: 'child-1', role: 'child' };

const sampleChore = {
  id: 'chore-1', title: 'Take out trash', pointValue: 5,
  requiresApproval: true, enabled: true, frequency: 'weekly',
  customIntervalDays: null, startDay: null,
};

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/chores/chore-1/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeApproveRequest(body: Record<string, unknown> = {}) {
  return new NextRequest('http://localhost:3000/api/chores/chore-1/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const routeParams = { params: Promise.resolve({ id: 'chore-1' }) };

describe('POST /api/chores/[id]/complete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryResults = [];
    queryIndex = 0;
    mockRequireAuth.mockResolvedValue(parentAuth);
    // Mirror requireRole: parents pass by role, tokens by scope.
    mockRequireRole.mockImplementation((auth: { role: string; scopes?: string[] }) => {
      const allowed = auth.scopes !== undefined ? auth.scopes.includes('*') : auth.role === 'parent';
      return allowed ? null : NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    });
  });

  it('parent completing chore auto-approves and awards points', async () => {
    // Query 1: chore lookup, Query 2: user lookup, Query 3: assignment, Query 4: pending completion
    queryResults = [
      [sampleChore],
      [{ id: 'parent-1', name: 'Dad', role: 'parent' }],
      [{ assignedTo: null }],
      [], // no pending
    ];

    const completion = {
      id: 'comp-1', choreId: 'chore-1', completedBy: 'parent-1',
      completedAt: new Date(), photoUrl: null, notes: null,
      pointsAwarded: 5, approvedBy: 'parent-1', approvedAt: new Date(),
    };
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        insert: () => ({ values: () => ({ returning: jest.fn().mockResolvedValue([completion]) }) }),
        update: () => ({ set: () => ({ where: jest.fn().mockResolvedValue(undefined) }) }),
      });
    });

    const res = await completeChore(makeRequest({ completedBy: 'parent-1' }), routeParams);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.approved).toBe(true);
    expect(data.requiresApproval).toBe(false);
    expect(data.pointsAwarded).toBe(5);
    expect(data.message).toContain('points awarded');
    // Scheduled from the household's today, not the server's.
    expect(calculateNextDue).toHaveBeenLastCalledWith(
      sampleChore.frequency, sampleChore.customIntervalDays, sampleChore.startDay,
      todayKey('America/Chicago'),
    );
  });

  it('a voice-scoped token cannot self-approve, though tokens carry the parent role', async () => {
    mockRequireAuth.mockResolvedValue({ ...parentAuth, scopes: ['voice'] });
    queryResults = [
      [sampleChore],
      [{ id: 'child-1', name: 'Timmy', role: 'child' }],
      [{ assignedTo: 'child-1' }],
      [], // no pending
    ];

    let inserted: Record<string, unknown> | undefined;
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        insert: () => ({
          values: (v: Record<string, unknown>) => {
            inserted = v;
            return { returning: jest.fn().mockResolvedValue([{ ...v, id: 'comp-3' }]) };
          },
        }),
        update: () => { throw new Error('a pending completion must not move the schedule'); },
      });
    });

    const res = await completeChore(makeRequest({ completedBy: 'child-1' }), routeParams);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.approved).toBe(false);
    expect(inserted).toMatchObject({ approvedBy: null, approvedAt: null, pointsAwarded: 5 });
  });

  it('child completing chore creates pending completion', async () => {
    mockRequireAuth.mockResolvedValue(childAuth);
    queryResults = [
      [sampleChore],
      [{ id: 'child-1', name: 'Timmy', role: 'child' }],
      [{ assignedTo: 'child-1' }],
      [], // no pending
    ];

    const completion = {
      id: 'comp-2', choreId: 'chore-1', completedBy: 'child-1',
      completedAt: new Date(), photoUrl: null, notes: null,
      pointsAwarded: 5, approvedBy: null, approvedAt: null,
    };
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        insert: () => ({ values: () => ({ returning: jest.fn().mockResolvedValue([completion]) }) }),
      });
    });

    const res = await completeChore(makeRequest({ completedBy: 'child-1' }), routeParams);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.approved).toBe(false);
    expect(data.requiresApproval).toBe(true);
    expect(data.isChildCompletion).toBe(true);
    expect(data.message).toContain('pending parent approval');
  });

  it('child completing a chore not flagged requiresApproval is approved at once', async () => {
    mockRequireAuth.mockResolvedValue(childAuth);
    queryResults = [
      [{ ...sampleChore, requiresApproval: false }],
      [{ id: 'child-1', name: 'Timmy', role: 'child' }],
      [{ assignedTo: 'child-1' }],
      [], // no pending
    ];

    let inserted: Record<string, unknown> | undefined;
    let scheduleMoved = false;
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        insert: () => ({
          values: (v: Record<string, unknown>) => {
            inserted = v;
            return { returning: jest.fn().mockResolvedValue([{ ...v, id: 'comp-4', completedAt: new Date() }]) };
          },
        }),
        update: () => ({ set: () => ({ where: jest.fn().mockImplementation(async () => { scheduleMoved = true; }) }) }),
      });
    });

    const res = await completeChore(makeRequest({ completedBy: 'child-1' }), routeParams);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.approved).toBe(true);
    expect(data.requiresApproval).toBe(false);
    expect(data.message).toContain('points awarded');
    expect(inserted).toMatchObject({ completedBy: 'child-1', approvedBy: 'child-1', pointsAwarded: 5 });
    expect(scheduleMoved).toBe(true);
  });

  it('rejects completion of disabled chore', async () => {
    queryResults = [
      [{ ...sampleChore, enabled: false }],
    ];

    const res = await completeChore(makeRequest({ completedBy: 'parent-1' }), routeParams);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('disabled');
  });

  it('returns 404 for nonexistent chore', async () => {
    queryResults = [
      [], // no chore
    ];

    const res = await completeChore(makeRequest({ completedBy: 'parent-1' }), routeParams);
    expect(res.status).toBe(404);
  });

  it('returns 404 for nonexistent completing user', async () => {
    queryResults = [
      [sampleChore],
      [], // no user
    ];

    const res = await completeChore(makeRequest({ completedBy: 'nobody' }), routeParams);
    expect(res.status).toBe(404);
  });

  it('child cannot complete chore assigned to another child', async () => {
    mockRequireAuth.mockResolvedValue(childAuth);
    queryResults = [
      [sampleChore],
      [{ id: 'child-1', name: 'Timmy', role: 'child' }],
      [{ assignedTo: 'child-2' }], // assigned to someone else
    ];

    const res = await completeChore(makeRequest({ completedBy: 'child-1' }), routeParams);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain('assigned to you');
  });

  it('returns 409 when child tries duplicate pending completion', async () => {
    mockRequireAuth.mockResolvedValue(childAuth);
    queryResults = [
      [sampleChore],
      [{ id: 'child-1', name: 'Timmy', role: 'child' }],
      [{ assignedTo: 'child-1' }],
      [{ id: 'existing-comp', completedBy: 'child-1' }], // existing pending
    ];

    const res = await completeChore(makeRequest({ completedBy: 'child-1' }), routeParams);
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.alreadyPending).toBe(true);
  });
});

describe('POST /api/chores/[id]/approve', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryResults = [];
    queryIndex = 0;
    mockRequireAuth.mockResolvedValue(parentAuth);
    mockRequireRole.mockReturnValue(null);
  });

  it('parent approves pending completion successfully', async () => {
    queryResults = [
      [sampleChore], // chore lookup
      [{ id: 'comp-1', choreId: 'chore-1', completedBy: 'child-1', completedAt: new Date('2026-02-15T10:00:00Z'), pointsAwarded: 5 }], // pending completion
      [{ name: 'Timmy', color: '#FF0000' }], // completing user
      [{ name: 'Dad' }], // approving user
    ];

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        update: () => ({ set: () => ({ where: jest.fn().mockResolvedValue(undefined) }) }),
      });
    });

    const res = await approveChore(makeApproveRequest(), routeParams);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toContain('approved');
    expect(data.completion.approvedBy.id).toBe('parent-1');
    expect(data.completion.completedBy.name).toBe('Timmy');
    expect(data.completion.pointsAwarded).toBe(5);
    expect(calculateNextDue).toHaveBeenLastCalledWith(
      sampleChore.frequency, sampleChore.customIntervalDays, sampleChore.startDay,
      todayKey('America/Chicago'),
    );
  });

  it('returns 403 when non-parent tries to approve', async () => {
    mockRequireRole.mockReturnValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    );

    const res = await approveChore(makeApproveRequest(), routeParams);
    expect(res.status).toBe(403);
  });

  it('returns 404 when chore does not exist', async () => {
    queryResults = [[]]; // no chore

    const res = await approveChore(makeApproveRequest(), routeParams);
    expect(res.status).toBe(404);
  });

  it('returns 404 when no pending completion exists', async () => {
    queryResults = [
      [sampleChore],
      [], // no pending completion
    ];

    const res = await approveChore(makeApproveRequest(), routeParams);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain('No pending completion');
  });

  it('falls back to "Unknown" when completing user was deleted', async () => {
    queryResults = [
      [sampleChore],
      [{ id: 'comp-1', choreId: 'chore-1', completedBy: 'deleted-user', completedAt: new Date(), pointsAwarded: 5 }],
      [], // deleted user → empty
      [{ name: 'Dad' }],
    ];

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        update: () => ({ set: () => ({ where: jest.fn().mockResolvedValue(undefined) }) }),
      });
    });

    const res = await approveChore(makeApproveRequest(), routeParams);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.completion.completedBy.name).toBe('Unknown');
    expect(data.completion.completedBy.color).toBe('#888888');
  });
});
