/**
 * @jest-environment node
 *
 * Voice chore completion (#530, #597): a chore not flagged requiresApproval is
 * approved at once by its assignee and moves the schedule on, and a flagged
 * one is always pending by voice, even a parent's, since the speaker cannot be
 * verified. Every completion records its points, so a pending one counts once
 * a parent approves it.
 */

import { NextRequest } from 'next/server';

let queryResults: unknown[][] = [];
let queryIndex = 0;

function makeChain() {
  const proxy: unknown = new Proxy({}, {
    get: (_target, prop) => {
      if (prop === 'then') {
        const p = Promise.resolve(queryResults[queryIndex++] ?? []);
        return p.then.bind(p);
      }
      if (prop === 'catch') return () => undefined;
      return () => proxy;
    },
  });
  return proxy;
}

let inserted: Record<string, unknown> | undefined;
let scheduleUpdate: Record<string, unknown> | undefined;
const mockTransaction = jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
  fn({
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        inserted = v;
        return { returning: async () => [{ ...v, id: 'comp-1' }] };
      },
    }),
    update: () => ({
      set: (v: Record<string, unknown>) => {
        scheduleUpdate = v;
        return { where: async () => undefined };
      },
    }),
  }),
);

jest.mock('@/lib/db/client', () => ({
  db: new Proxy({}, {
    get: (_target, prop) =>
      prop === 'transaction' ? (fn: never) => mockTransaction(fn) : () => makeChain(),
  }),
}));
jest.mock('@/lib/api/withAuth', () => ({
  withAuth: (handler: (auth: unknown) => unknown) =>
    handler({ userId: 'token-owner', role: 'parent', scopes: ['voice'] }),
}));
jest.mock('@/lib/cache/cacheKeys', () => ({ invalidateEntity: jest.fn() }));
jest.mock('@/lib/services/auditLog', () => ({ logActivity: jest.fn() }));
jest.mock('@/lib/householdTimezone', () => ({
  getHouseholdTimezone: jest.fn().mockResolvedValue('America/Chicago'),
}));
jest.mock('@/lib/utils/calculateNextDue', () => ({
  calculateNextDue: jest.fn().mockReturnValue('2026-10-05'),
}));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));

import { POST } from '../route';
import { calculateNextDue } from '@/lib/utils/calculateNextDue';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { todayKey } from '@/lib/utils/zonedDate';

const baseChore = {
  id: 'chore-1',
  title: 'Feed the dog',
  assignedTo: 'member-1',
  assigneeName: 'Robin',
  assigneeRole: 'child',
  requiresApproval: false,
  pointValue: 5,
  frequency: 'weekly',
  customIntervalDays: null,
  startDay: null,
  enabled: true,
};

function request(body: Record<string, unknown> = { chore: 'feed the dog' }) {
  return new NextRequest('http://localhost:3000/api/v1/voice/chore/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/voice/chore/complete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryResults = [];
    queryIndex = 0;
    inserted = undefined;
    scheduleUpdate = undefined;
  });

  it("approves a parent's own chore as that parent and moves the schedule on", async () => {
    queryResults = [[{ ...baseChore, assigneeRole: 'parent' }]];

    const res = await POST(request());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.pending).toBe(false);
    expect(inserted).toMatchObject({
      completedBy: 'member-1',
      approvedBy: 'member-1',
      pointsAwarded: 5,
    });
    expect(inserted?.approvedAt).toBeInstanceOf(Date);
    expect(scheduleUpdate).toMatchObject({ nextDue: '2026-10-05' });
    expect(calculateNextDue).toHaveBeenCalledWith('weekly', null, null, todayKey('America/Chicago'));
    expect(invalidateEntity).toHaveBeenCalledWith('chores');
  });

  it("approves a child's chore at once when it is not flagged requiresApproval", async () => {
    queryResults = [[baseChore], []]; // match, then no pending completion

    const res = await POST(request());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.pending).toBe(false);
    expect(inserted).toMatchObject({ completedBy: 'member-1', approvedBy: 'member-1', pointsAwarded: 5 });
    expect(scheduleUpdate).toMatchObject({ nextDue: '2026-10-05' });
  });

  it("leaves a child's flagged chore pending, with its points recorded for approval", async () => {
    queryResults = [[{ ...baseChore, requiresApproval: true }], []]; // match, then no pending completion

    const res = await POST(request());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.pending).toBe(true);
    expect(body.spoken).toContain('A parent will need to approve');
    expect(inserted).toMatchObject({
      completedBy: 'member-1',
      approvedBy: null,
      approvedAt: null,
      pointsAwarded: 5,
    });
    expect(scheduleUpdate).toBeUndefined();
  });

  it("keeps a parent's chore pending when it is flagged requiresApproval", async () => {
    queryResults = [[{ ...baseChore, assigneeRole: 'parent', requiresApproval: true }]];

    const res = await POST(request());
    const body = await res.json();

    expect(body.data.pending).toBe(true);
    expect(inserted).toMatchObject({ approvedBy: null, pointsAwarded: 5 });
    expect(scheduleUpdate).toBeUndefined();
  });

  it("refuses a second completion of a child's chore while one is pending", async () => {
    queryResults = [[baseChore], [{ id: 'comp-0', completedBy: 'member-1' }]];

    const res = await POST(request());
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(inserted).toBeUndefined();
  });
});
