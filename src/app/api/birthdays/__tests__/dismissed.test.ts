/**
 * Removing a birthday and undoing it (#605): parents only, the delete leaves a
 * tombstone so sync does not re-add the entry, and restoring drops the
 * tombstone and re-runs detection.
 *
 * withAuth and requireRole are the real ones, so a change to who holds
 * canModifySettings shows up here rather than passing behind a mock.
 */
const mockRequireAuth = jest.fn();
const mockSelectWhere = jest.fn();
const mockSelectOrderBy = jest.fn();
const mockDeleteWhere = jest.fn();
const mockDeleteReturning = jest.fn();
const mockDismiss = jest.fn();
const mockDetect = jest.fn();
const mockInvalidate = jest.fn();

jest.mock('@/lib/auth', () => ({
  requireAuth: (...a: unknown[]) => mockRequireAuth(...a),
  requireRole: jest.requireActual('@/lib/auth/requireAuth').requireRole,
}));
jest.mock('@/lib/db/client', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (...a: unknown[]) => mockSelectWhere(...a),
        orderBy: (...a: unknown[]) => mockSelectOrderBy(...a),
      }),
    }),
    delete: () => ({
      where: (...a: unknown[]) => {
        mockDeleteWhere(...a);
        return Object.assign(Promise.resolve(), {
          returning: (...r: unknown[]) => mockDeleteReturning(...r),
        });
      },
    }),
  },
}));
jest.mock('@/lib/db/schema', () => ({
  birthdays: { id: 'id', name: 'name', birthDate: 'bd', eventType: 'et', googleCalendarSource: 'gcs' },
  users: { id: 'id' },
  dismissedBirthdays: { id: 'id', normalizedName: 'nn', birthMonth: 'bm', birthDay: 'bday', eventType: 'et' },
}));
jest.mock('drizzle-orm', () => ({ eq: jest.fn(), asc: jest.fn() }));
jest.mock('@/lib/services/birthday-detect', () => ({
  dismissBirthday: (...a: unknown[]) => mockDismiss(...a),
  detectBirthdaysFromEvents: (...a: unknown[]) => mockDetect(...a),
}));
jest.mock('@/lib/cache/cacheKeys', () => ({ invalidateEntity: (...a: unknown[]) => mockInvalidate(...a) }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));

import { NextRequest } from 'next/server';
import { DELETE as DELETE_BIRTHDAY } from '../[id]/route';
import { GET as LIST_DISMISSED } from '../dismissed/route';
import { DELETE as RESTORE } from '../dismissed/[id]/route';

const ctx = { params: Promise.resolve({ id: 'b1' }) };
const req = (url: string) => new NextRequest(`http://localhost${url}`, { method: 'DELETE' });

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ userId: 'p1', role: 'parent' });
  mockSelectWhere.mockResolvedValue([{ id: 'b1', name: 'Pat Example', birthDate: '2010-04-02', eventType: 'birthday', source: 'Family' }]);
  mockSelectOrderBy.mockResolvedValue([{ id: 'd1', name: 'pat example', month: 4, day: 2, eventType: 'birthday' }]);
  mockDeleteReturning.mockResolvedValue([{ id: 'd1' }]);
  mockDetect.mockResolvedValue({ added: 1, updated: 0, total: 1, errors: [] });
});

describe('DELETE /api/birthdays/[id]', () => {
  it('tombstones a synced one, deletes it and refreshes the cached list', async () => {
    const res = await DELETE_BIRTHDAY(req('/api/birthdays/b1'), ctx);
    expect(res.status).toBe(200);
    expect(mockDismiss).toHaveBeenCalledWith({ name: 'Pat Example', birthDate: '2010-04-02', eventType: 'birthday' });
    expect(mockDeleteWhere).toHaveBeenCalled();
    expect(mockInvalidate).toHaveBeenCalledWith('birthdays');
  });

  it('deletes a hand-entered one outright, with no tombstone', async () => {
    mockSelectWhere.mockResolvedValue([{ id: 'b1', name: 'Pat Example', birthDate: '2010-04-02', eventType: 'birthday', source: null }]);
    const res = await DELETE_BIRTHDAY(req('/api/birthdays/b1'), ctx);
    expect(res.status).toBe(200);
    expect(mockDismiss).not.toHaveBeenCalled();
    expect(mockDeleteWhere).toHaveBeenCalled();
  });

  it.each(['child', 'guest'])('refuses a %s', async (role) => {
    mockRequireAuth.mockResolvedValue({ userId: 'k1', role });
    const res = await DELETE_BIRTHDAY(req('/api/birthdays/b1'), ctx);
    expect(res.status).toBe(403);
    expect(mockDismiss).not.toHaveBeenCalled();
    expect(mockDeleteWhere).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown id', async () => {
    mockSelectWhere.mockResolvedValue([]);
    const res = await DELETE_BIRTHDAY(req('/api/birthdays/nope'), ctx);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/birthdays/dismissed', () => {
  it('lists the tombstones', async () => {
    const res = await LIST_DISMISSED();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      dismissed: [{ id: 'd1', name: 'pat example', month: 4, day: 2, eventType: 'birthday' }],
    });
  });

  it('refuses a child', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'k1', role: 'child' });
    const res = await LIST_DISMISSED();
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/birthdays/dismissed/[id]', () => {
  const rctx = { params: Promise.resolve({ id: 'd1' }) };

  it('drops the tombstone and re-runs detection', async () => {
    const res = await RESTORE(req('/api/birthdays/dismissed/d1'), rctx);
    expect(res.status).toBe(200);
    expect(mockDeleteReturning).toHaveBeenCalled();
    expect(mockDetect).toHaveBeenCalled();
  });

  it('still succeeds when re-detection fails', async () => {
    mockDetect.mockRejectedValue(new Error('db busy'));
    const res = await RESTORE(req('/api/birthdays/dismissed/d1'), rctx);
    expect(res.status).toBe(200);
  });

  it('answers 404 when there is no such tombstone', async () => {
    mockDeleteReturning.mockResolvedValue([]);
    const res = await RESTORE(req('/api/birthdays/dismissed/nope'), rctx);
    expect(res.status).toBe(404);
    expect(mockDetect).not.toHaveBeenCalled();
  });

  it('refuses a child', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'k1', role: 'child' });
    const res = await RESTORE(req('/api/birthdays/dismissed/d1'), rctx);
    expect(res.status).toBe(403);
    expect(mockDeleteReturning).not.toHaveBeenCalled();
  });
});
