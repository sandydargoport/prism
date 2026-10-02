/**
 * Hiding an event in Prism (#592): parents only, local only, and listed for
 * Settings so a hidden event can be shown again.
 *
 * requireRole is the real one, so a change to who holds canEditAnyEvent shows
 * up here rather than passing behind a mock.
 */
const mockRequireAuth = jest.fn();
const mockUpdateSet = jest.fn();
const mockReturning = jest.fn();
const mockSelectOrderBy = jest.fn();
const mockInvalidate = jest.fn();

jest.mock('@/lib/auth', () => ({
  requireAuth: (...a: unknown[]) => mockRequireAuth(...a),
  requireRole: jest.requireActual('@/lib/auth/requireAuth').requireRole,
}));
jest.mock('@/lib/db/client', () => ({
  db: {
    update: () => ({
      set: (v: unknown) => {
        mockUpdateSet(v);
        return { where: () => ({ returning: (...a: unknown[]) => mockReturning(...a) }) };
      },
    }),
    select: () => ({
      from: () => ({
        leftJoin: () => ({ where: () => ({ orderBy: (...a: unknown[]) => mockSelectOrderBy(...a) }) }),
      }),
    }),
  },
}));
jest.mock('@/lib/db/schema', () => ({
  events: { id: 'id', title: 'title', startTime: 'st', allDay: 'ad', hiddenAt: 'ha', calendarSourceId: 'csid' },
  calendarSources: { id: 'id', dashboardCalendarName: 'dcn', displayName: 'dn' },
}));
jest.mock('drizzle-orm', () => ({ eq: jest.fn(), desc: jest.fn(), isNotNull: jest.fn() }));
jest.mock('@/lib/cache/cacheKeys', () => ({ invalidateEntity: (...a: unknown[]) => mockInvalidate(...a) }));
jest.mock('@/lib/services/auditLog', () => ({ logActivity: jest.fn() }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));

import { NextRequest } from 'next/server';
import { PUT, DELETE } from '../[id]/hidden/route';
import { GET } from '../hidden/route';

const ctx = { params: Promise.resolve({ id: 'e1' }) };
const req = (method: string) => new NextRequest('http://localhost/api/events/e1/hidden', { method });

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ userId: 'p1', role: 'parent' });
  mockReturning.mockResolvedValue([{ id: 'e1', title: 'Swim practice' }]);
});

describe('PUT /api/events/[id]/hidden', () => {
  it('stamps hiddenAt and drops the cached event lists', async () => {
    const res = await PUT(req('PUT'), ctx);
    expect(res.status).toBe(200);
    expect(mockUpdateSet).toHaveBeenCalledWith({ hiddenAt: expect.any(Date) });
    expect(mockInvalidate).toHaveBeenCalledWith('events');
  });

  it.each(['child', 'guest'])('refuses a %s', async (role) => {
    mockRequireAuth.mockResolvedValue({ userId: 'k1', role });
    const res = await PUT(req('PUT'), ctx);
    expect(res.status).toBe(403);
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it('answers 404 for an event that does not exist', async () => {
    mockReturning.mockResolvedValue([]);
    expect((await PUT(req('PUT'), ctx)).status).toBe(404);
    expect(mockInvalidate).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/events/[id]/hidden', () => {
  it('clears hiddenAt', async () => {
    const res = await DELETE(req('DELETE'), ctx);
    expect(res.status).toBe(200);
    expect(mockUpdateSet).toHaveBeenCalledWith({ hiddenAt: null });
  });

  it('refuses a child', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'k1', role: 'child' });
    expect((await DELETE(req('DELETE'), ctx)).status).toBe(403);
  });
});

describe('GET /api/events/hidden', () => {
  it('lists hidden events with their calendar name', async () => {
    mockSelectOrderBy.mockResolvedValue([
      { id: 'e1', title: 'Swim practice', startTime: new Date('2026-10-05T16:00:00Z'), allDay: false, dashboardName: null, displayName: 'Kids' },
      { id: 'e2', title: 'Local thing', startTime: new Date('2026-10-06T00:00:00Z'), allDay: true, dashboardName: null, displayName: null },
    ]);
    const body = await (await GET()).json();
    expect(body.hidden).toEqual([
      expect.objectContaining({ id: 'e1', calendarName: 'Kids' }),
      expect.objectContaining({ id: 'e2', calendarName: null }),
    ]);
  });

  it('refuses a child', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'k1', role: 'child' });
    expect((await GET()).status).toBe(403);
  });
});
