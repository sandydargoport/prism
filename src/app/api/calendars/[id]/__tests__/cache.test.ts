/**
 * A calendar turned off, recoloured, renamed or deleted shows at once (#1226):
 * events and calendar groups are cached and carry the calendar's colour, name
 * and enabled flag, so every change to a calendar drops both cached lists.
 */
const mockAuth = jest.fn();
const mockInvalidate = jest.fn();
const existing = { id: 'c1', provider: 'ical', sourceCalendarId: null, syncErrors: {}, displayName: 'School' };

jest.mock('@/lib/auth', () => ({
  requireAuth: () => mockAuth(),
  requireRole: (auth: { role: string }) => {
    if (auth.role === 'parent') return null;
    const { NextResponse } = jest.requireActual('next/server');
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  },
}));
jest.mock('@/lib/cache/cacheKeys', () => ({
  invalidateEntity: (e: unknown) => mockInvalidate(e),
  invalidateEntities: (...a: unknown[]) => a.forEach((e) => mockInvalidate(e)),
}));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));
jest.mock('@/lib/services/settingsTombstone', () => ({ addTombstone: jest.fn() }));
jest.mock('@/lib/integrations/google-calendar', () => ({ DISMISSED_GOOGLE_CALENDARS_KEY: 'k' }));
jest.mock('@/lib/calendar/displayRules', () => ({ parseDisplayRules: (r: unknown) => r }));
jest.mock('@/lib/db/schema', () => ({ calendarSources: { id: 'id' }, events: {} }));
jest.mock('drizzle-orm', () => ({ eq: () => ({}) }));
jest.mock('@/lib/db/client', () => ({
  db: {
    query: { calendarSources: { findFirst: () => Promise.resolve(existing) } },
    update: () => ({
      set: (v: Record<string, unknown>) => ({
        where: () => ({
          returning: () => Promise.resolve([{ ...existing, ...v, updatedAt: new Date(), lastSynced: null }]),
        }),
      }),
    }),
    delete: () => ({ where: () => Promise.resolve() }),
  },
}));

import { NextRequest } from 'next/server';
import { PATCH, DELETE } from '../route';

const params = { params: Promise.resolve({ id: 'c1' }) };
const req = (method: string, body?: unknown) =>
  new NextRequest('http://localhost/api/calendars/c1', { method, body: body === undefined ? undefined : JSON.stringify(body) });

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue({ userId: 'u1', role: 'parent' });
});

describe('/api/calendars/[id] drops cached events and calendar groups', () => {
  it.each([
    ['turned off', { enabled: false }],
    ['recoloured', { color: '#112233' }],
    ['renamed', { dashboardCalendarName: 'Swim team' }],
    ['moved to a group', { groupId: 'g1' }],
  ])('when %s', async (_label, body) => {
    const res = await PATCH(req('PATCH', body), params);
    expect(res.status).toBe(200);
    expect(mockInvalidate).toHaveBeenCalledWith('events');
    expect(mockInvalidate).toHaveBeenCalledWith('calendar-groups');
  });

  it('when deleted', async () => {
    const res = await DELETE(req('DELETE'), params);
    expect(res.status).toBe(200);
    expect(mockInvalidate).toHaveBeenCalledWith('events');
    expect(mockInvalidate).toHaveBeenCalledWith('calendar-groups');
  });

  it('not when the change is refused', async () => {
    mockAuth.mockResolvedValue({ userId: 'u2', role: 'child' });
    expect((await PATCH(req('PATCH', { enabled: false }), params)).status).toBe(403);
    expect((await DELETE(req('DELETE'), params)).status).toBe(403);
    expect(mockInvalidate).not.toHaveBeenCalled();
  });
});
