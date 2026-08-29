/**
 * The review that decides what happens to tasks a provider stopped listing.
 *
 * The case worth pinning hardest is 'keep': task sync pushes local tasks UP to
 * the provider, so a kept task that merely loses its link would be recreated on
 * the provider it was just deleted from, flagged again, kept again, forever.
 * Calendar can get away with detaching because its sync never pushes. These
 * tests exist so that difference cannot be refactored away.
 */
const mockRequireAuth = jest.fn();
const mockRequireRole = jest.fn();
const mockDisplayAuth = jest.fn();
const mockSelectWhere = jest.fn();
const mockUpdateSet = jest.fn();
const mockDeleteWhere = jest.fn();

jest.mock('@/lib/auth', () => ({
  requireAuth: (...a: unknown[]) => mockRequireAuth(...a),
  requireRole: (...a: unknown[]) => mockRequireRole(...a),
  getDisplayAuth: (...a: unknown[]) => mockDisplayAuth(...a),
}));
jest.mock('@/lib/db/client', () => ({
  db: {
    select: () => ({
      from: () => ({
        leftJoin: () => ({
          leftJoin: () => ({ where: () => ({ orderBy: (...a: unknown[]) => mockSelectWhere(...a) }) }),
        }),
        where: (...a: unknown[]) => mockSelectWhere(...a),
      }),
    }),
    update: () => ({ set: (v: unknown) => { mockUpdateSet(v); return { where: () => Promise.resolve() }; } }),
    delete: () => ({ where: (...a: unknown[]) => { mockDeleteWhere(...a); return Promise.resolve(); } }),
  },
}));
jest.mock('@/lib/db/schema', () => ({
  tasks: { id: 'id', title: 'title', dueDate: 'due', completed: 'done', pendingDeletion: 'pd', taskSourceId: 'tsid', listId: 'lid' },
  taskSources: { id: 'id', provider: 'p', externalListName: 'eln' },
  taskLists: { id: 'id', name: 'n' },
}));
jest.mock('drizzle-orm', () => ({ and: jest.fn(), eq: jest.fn(), inArray: jest.fn(), isNotNull: jest.fn() }));
jest.mock('@/lib/cache/cacheKeys', () => ({ invalidateEntity: jest.fn() }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));

import { NextRequest, NextResponse } from 'next/server';
import { GET, POST } from '../pending-deletions/route';

function req(body: unknown) {
  return new NextRequest('http://localhost/api/tasks/pending-deletions', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ userId: 'p1', role: 'parent' });
  mockRequireRole.mockReturnValue(undefined);
  mockDisplayAuth.mockResolvedValue({ userId: 'p1' });
  mockSelectWhere.mockResolvedValue([{ id: 't1' }, { id: 't2' }]);
});

describe('GET /api/tasks/pending-deletions', () => {
  it('returns an empty list for an unauthenticated display rather than 401', async () => {
    // The shared wall display is not signed in but still shows the badge.
    mockDisplayAuth.mockResolvedValue(null);
    const res = await GET();
    expect(await res.json()).toEqual({ pending: [], count: 0 });
  });

  it('reports what is waiting', async () => {
    mockSelectWhere.mockResolvedValue([
      { id: 't1', title: 'Bins', dueDate: null, completed: false, provider: 'google_tasks', listName: 'Home', prismList: 'Chores' },
    ]);
    const body = await (await GET()).json();
    expect(body.count).toBe(1);
    expect(body.pending[0].source).toBe('Google Tasks — Home');
  });
});

describe('POST — keep', () => {
  it('sets syncExempt, or the reconciler pushes the task straight back', async () => {
    // THE regression test. Without syncExempt the task is recreated on the
    // provider within about five minutes and the loop never ends.
    await POST(req({ taskIds: ['t1', 't2'], action: 'keep' }));
    expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ syncExempt: true }));
  });

  it('also clears the flag and the link', async () => {
    await POST(req({ taskIds: ['t1'], action: 'keep' }));
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ pendingDeletion: null, taskSourceId: null, externalId: null }),
    );
  });

  it('never deletes anything', async () => {
    await POST(req({ taskIds: ['t1'], action: 'keep' }));
    expect(mockDeleteWhere).not.toHaveBeenCalled();
  });
});

describe('POST — delete', () => {
  it('removes the selected tasks', async () => {
    const res = await POST(req({ taskIds: ['t1', 't2'], action: 'delete' }));
    expect(mockDeleteWhere).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual({ applied: 2, action: 'delete' });
  });
});

describe('POST — guards', () => {
  it('rejects an unknown action instead of guessing', async () => {
    const res = await POST(req({ taskIds: ['t1'], action: 'archive' }));
    expect(res.status).toBe(400);
    expect(mockDeleteWhere).not.toHaveBeenCalled();
  });

  it('rejects an empty selection', async () => {
    expect((await POST(req({ taskIds: [], action: 'delete' }))).status).toBe(400);
  });

  it('ignores non-string ids rather than passing them to the query', async () => {
    const res = await POST(req({ taskIds: [42, null], action: 'delete' }));
    expect(res.status).toBe(400);
  });

  it('does nothing when the ids are stale and no longer flagged', async () => {
    // A cached page can post ids the user already actioned elsewhere. The
    // route re-selects on pendingDeletion IS NOT NULL, so these are no-ops.
    mockSelectWhere.mockResolvedValue([]);
    const res = await POST(req({ taskIds: ['gone'], action: 'delete' }));
    expect(await res.json()).toEqual({ applied: 0, action: 'delete' });
    expect(mockDeleteWhere).not.toHaveBeenCalled();
  });

  it('refuses a role without delete permission', async () => {
    mockRequireRole.mockReturnValue(NextResponse.json({ error: 'forbidden' }, { status: 403 }));
    const res = await POST(req({ taskIds: ['t1'], action: 'delete' }));
    expect(res.status).toBe(403);
    expect(mockDeleteWhere).not.toHaveBeenCalled();
  });
});
