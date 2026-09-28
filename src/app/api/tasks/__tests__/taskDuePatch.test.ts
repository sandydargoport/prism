/**
 * PATCH /api/tasks/[id] with a due date and time.
 *
 * The due is a date plus an optional time. A calendar drag sends only the new
 * date, so the stored time must survive it; clearing the date clears both.
 */
const mockSelectExisting = jest.fn();
const mockUpdateSet = jest.fn();

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(async () => ({ userId: 'p1', role: 'parent' })),
  requireRole: jest.fn(),
}));
jest.mock('@/lib/db/client', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => mockSelectExisting(),
        leftJoin: () => ({
          where: async () => [{
            id: 't1', title: 'Return library books', description: null,
            dueDate: '2026-10-01', dueTime: '09:00', priority: null, category: null,
            completed: false, completedAt: null, listId: null, taskSourceId: null,
            createdAt: new Date(0), updatedAt: new Date(0),
            assignedUserId: null, assignedUserName: null, assignedUserColor: null, assignedUserAvatar: null,
          }],
        }),
      }),
    }),
    update: () => ({ set: (v: unknown) => { mockUpdateSet(v); return { where: () => Promise.resolve() }; } }),
  },
}));
jest.mock('@/lib/cache/cacheKeys', () => ({ invalidateEntity: jest.fn() }));
jest.mock('@/lib/services/auditLog', () => ({ logActivity: jest.fn() }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));
jest.mock('@/lib/integrations/tasks/providerAuth', () => ({ resolveTaskProviderAuth: jest.fn() }));
jest.mock('@/lib/householdTimezone', () => ({
  getHouseholdTimezone: jest.fn(async () => 'America/Chicago'),
}));

import { NextRequest } from 'next/server';
import { PATCH } from '../[id]/route';

function patch(body: unknown) {
  return PATCH(
    new NextRequest('http://localhost/api/tasks/t1', {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id: 't1' }) },
  );
}

function existing(dueDate: string | null) {
  mockSelectExisting.mockResolvedValue([{ id: 't1', assignedTo: null, createdBy: 'p1', dueDate }]);
}

beforeEach(() => {
  jest.clearAllMocks();
  existing('2026-09-28');
});

describe('PATCH /api/tasks/[id] due', () => {
  it('moves the date and leaves the stored time alone', async () => {
    const res = await patch({ dueDate: '2026-10-01' });
    expect(res.status).toBe(200);
    const set = mockUpdateSet.mock.calls[0][0];
    expect(set.dueDate).toBe('2026-10-01');
    expect(set).not.toHaveProperty('dueTime');
  });

  it('sets a date and time together', async () => {
    await patch({ dueDate: '2026-10-01', dueTime: '09:00' });
    expect(mockUpdateSet.mock.calls[0][0]).toMatchObject({ dueDate: '2026-10-01', dueTime: '09:00' });
  });

  it('clears the time with the date', async () => {
    await patch({ dueDate: null });
    expect(mockUpdateSet.mock.calls[0][0]).toMatchObject({ dueDate: null, dueTime: null });
  });

  it('reads an ISO date-time from an older client in the household zone', async () => {
    // 23:59:59 CDT on 1 October, the old "no time" value.
    await patch({ dueDate: '2026-10-02T04:59:59.000Z' });
    expect(mockUpdateSet.mock.calls[0][0]).toMatchObject({ dueDate: '2026-10-01', dueTime: null });
  });

  it('refuses a time on a task with no date', async () => {
    existing(null);
    const res = await patch({ dueTime: '09:00' });
    expect(res.status).toBe(400);
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it('refuses a date that is not one', async () => {
    const res = await patch({ dueDate: '2026-02-30' });
    expect(res.status).toBe(400);
  });
});
