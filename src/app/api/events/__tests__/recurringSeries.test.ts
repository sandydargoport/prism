/**
 * Repeating events made in Prism show every occurrence (#59).
 *
 * Before, a series Prism kept itself (a Prism calendar, or a calendar the
 * series could not be added to) was stored once with its RRULE and nothing
 * expanded it, so "Weekly" showed on the first date only. GET now serves one
 * event per occurrence under an id naming its start, and the per-event routes
 * read that id back to the series row.
 */
const mockRequireAuth = jest.fn();
const mockResults: unknown[][] = [];
const mockUpdateSet = jest.fn();
const mockDeleteWhere = jest.fn();
const mockInsertValues = jest.fn();
const mockGoogleCreate = jest.fn();

/** A query chain: every builder call returns it, awaiting it yields the next queued result. */
function chain(): unknown {
  const target = {
    then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
      Promise.resolve(mockResults.shift() ?? []).then(resolve, reject),
  };
  return new Proxy(target, {
    get: (t, prop) => (prop === 'then' ? t.then : () => chain()),
  });
}

jest.mock('@/lib/auth', () => ({
  requireAuth: (...a: unknown[]) => mockRequireAuth(...a),
  getDisplayAuth: (...a: unknown[]) => mockRequireAuth(...a),
  requireRole: jest.requireActual('@/lib/auth/requireAuth').requireRole,
}));
jest.mock('@/lib/db/client', () => ({
  db: {
    select: () => chain(),
    update: () => ({
      set: (v: unknown) => {
        mockUpdateSet(v);
        return { where: async () => undefined };
      },
    }),
    delete: () => ({ where: async (w: unknown) => mockDeleteWhere(w) }),
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        mockInsertValues(v);
        return { returning: async () => [{ id: 'new-1', ...v }] };
      },
    }),
  },
}));
jest.mock('drizzle-orm', () => {
  const op = (name: string) => (...a: unknown[]) => [name, ...a];
  return { ...jest.requireActual('drizzle-orm'), eq: op('eq'), and: op('and'), or: op('or'), gte: op('gte'), lte: op('lte'), asc: op('asc'), isNotNull: op('isNotNull'), isNull: op('isNull') };
});
jest.mock('@/lib/services/calendar-sync', () => ({
  pushCalDAVEventUpdate: jest.fn(),
  pushCalDAVEventCreate: jest.fn(),
  pushCalDAVEventDelete: jest.fn(),
}));
jest.mock('@/lib/services/hiddenEvents', () => ({ visibleEventsCondition: () => ['visible'] }));
jest.mock('@/lib/integrations/google-calendar', () => ({
  createCalendarEvent: (...a: unknown[]) => mockGoogleCreate(...a),
  toGoogleAllDayRange: jest.fn(),
  refreshAccessToken: jest.fn(),
}));
jest.mock('@/lib/utils/crypto', () => ({ decrypt: (v: string) => v, encrypt: (v: string) => v }));
jest.mock('@/lib/cache/rateLimit', () => ({ rateLimitGuard: async () => null }));
jest.mock('@/lib/householdTimezone', () => ({ getHouseholdTimezone: async () => 'America/Chicago' }));
jest.mock('@/lib/cache/cacheKeys', () => ({ invalidateEntity: jest.fn() }));
jest.mock('@/lib/cache/redis', () => ({ getCached: (_key: string, fn: () => unknown) => fn() }));
jest.mock('@/lib/services/auditLog', () => ({ logActivity: jest.fn() }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));

import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { PATCH, DELETE } from '../[id]/route';

const ROW_ID = '3f2a9c1e-0b7d-4e5f-9a12-6c8d4b2e1f00';

// Swim practice, Tuesdays 17:00-18:00 Chicago from 3 Nov 2026, on no
// external calendar.
const SERIES = {
  id: ROW_ID,
  title: 'Swim practice',
  description: null,
  location: null,
  startTime: new Date('2026-11-03T23:00:00Z'),
  endTime: new Date('2026-11-04T00:00:00Z'),
  allDay: false,
  recurring: true,
  recurrenceRule: 'FREQ=WEEKLY',
  externalEventId: null as string | null,
  seriesKey: null,
  caldavHref: null,
  createdBy: null,
  color: null,
  reminderMinutes: null,
  createdAt: new Date('2026-11-01T00:00:00Z'),
  updatedAt: new Date('2026-11-01T00:00:00Z'),
  calendarSourceId: null,
  calendarSourceName: null,
  calendarSourceColor: null,
  calendarSourceProvider: null,
};

const listReq = (start: string, end: string) =>
  new NextRequest(`http://localhost/api/events?startDate=${start}&endDate=${end}`);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  jest.clearAllMocks();
  mockResults.length = 0;
  mockRequireAuth.mockResolvedValue({ userId: 'p1', role: 'parent' });
});

describe('GET /api/events with a series Prism keeps', () => {
  it('serves one event per occurrence in the range, each under its own id', async () => {
    mockResults.push([SERIES]);
    const res = await GET(listReq('2026-11-15T00:00:00Z', '2026-12-01T00:00:00Z'));
    const body = await res.json();
    expect(body.events.map((e: { startTime: string }) => e.startTime)).toEqual([
      '2026-11-17T23:00:00.000Z',
      '2026-11-24T23:00:00.000Z',
    ]);
    expect(body.events.map((e: { id: string }) => e.id)).toEqual([
      `${ROW_ID}_${Date.parse('2026-11-17T23:00:00Z')}`,
      `${ROW_ID}_${Date.parse('2026-11-24T23:00:00Z')}`,
    ]);
    expect(body.events[0]).toMatchObject({ title: 'Swim practice', recurring: true, recurrenceRule: 'FREQ=WEEKLY' });
  });

  it('leaves a synced occurrence with a rule as it is', async () => {
    // CalDAV sync stores the series' rule on each occurrence row.
    mockResults.push([{ ...SERIES, externalEventId: 'swim@example.com_2026-11-03T23:00:00.000Z', seriesKey: 'swim@example.com' }]);
    const res = await GET(listReq('2026-11-01T00:00:00Z', '2026-12-01T00:00:00Z'));
    const body = await res.json();
    expect(body.events.map((e: { id: string }) => e.id)).toEqual([ROW_ID]);
  });

  it('expands a series just added to a calendar until a sync replaces it', async () => {
    mockResults.push([{ ...SERIES, externalEventId: 'swim@example.com' }]);
    const res = await GET(listReq('2026-11-15T00:00:00Z', '2026-12-01T00:00:00Z'));
    const body = await res.json();
    expect(body.events).toHaveLength(2);
  });
});

describe('PATCH /api/events/[occurrence id]', () => {
  const occurrence = new Date('2026-11-17T23:00:00Z');
  const occurrenceUrl = `${ROW_ID}_${occurrence.getTime()}`;
  const patch = (body: Record<string, unknown>) =>
    PATCH(new NextRequest(`http://localhost/api/events/${occurrenceUrl}`, { method: 'PATCH', body: JSON.stringify(body) }), ctx(occurrenceUrl));

  it('moves the series by the change made to the occurrence, keeping its first date', async () => {
    // The form shows 17 Nov 17:00-18:00; the user makes it 17:30-18:30.
    mockResults.push([SERIES], [SERIES]);
    const res = await patch({
      title: 'Swim practice',
      startTime: '2026-11-17T23:30:00.000Z',
      endTime: '2026-11-18T00:30:00.000Z',
      recurrenceRule: 'FREQ=WEEKLY',
    });
    expect(res.status).toBe(200);
    expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({
      startTime: new Date('2026-11-03T23:30:00Z'),
      endTime: new Date('2026-11-04T00:30:00Z'),
    }));
  });

  it('moves an all-day series by whole days', async () => {
    // All day every Monday from 2 Nov; the 16 Nov occurrence is moved to
    // Tuesday 17 Nov, sent as local midnights the way the form does.
    const allDay = { ...SERIES, allDay: true, startTime: new Date('2026-11-02T00:00:00Z'), endTime: new Date('2026-11-03T00:00:00Z') };
    const id = `${ROW_ID}_${Date.parse('2026-11-16T00:00:00Z')}`;
    mockResults.push([allDay], [allDay]);
    await PATCH(new NextRequest(`http://localhost/api/events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ startTime: '2026-11-17T06:00:00.000Z', endTime: '2026-11-18T06:00:00.000Z', allDay: true }),
    }), ctx(id));
    expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({
      startTime: new Date('2026-11-03T00:00:00Z'),
      endTime: new Date('2026-11-04T00:00:00Z'),
    }));
  });

  it('leaves the event where the form put it when the repeat is turned off', async () => {
    mockResults.push([SERIES], [SERIES]);
    await patch({
      startTime: '2026-11-17T23:00:00.000Z',
      endTime: '2026-11-18T00:00:00.000Z',
      recurrenceRule: null,
    });
    expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({
      startTime: occurrence,
      recurrenceRule: null,
    }));
  });
});

describe('DELETE /api/events/[occurrence id]', () => {
  it('deletes the series row', async () => {
    mockResults.push([SERIES]);
    const id = `${ROW_ID}_${Date.parse('2026-11-17T23:00:00Z')}`;
    const res = await DELETE(new NextRequest(`http://localhost/api/events/${id}`, { method: 'DELETE' }), ctx(id));
    expect(res.status).toBe(200);
    expect(mockDeleteWhere).toHaveBeenCalledWith(['eq', expect.anything(), ROW_ID]);
  });
});

describe('POST /api/events, a repeating event on a Google calendar', () => {
  it('sends the rule and the household zone, and stores the series row', async () => {
    const google = { id: '6f1c2a3e-0b4d-4e8f-9a7b-1c2d3e4f5a6b', provider: 'google', accessToken: 'token', sourceCalendarId: 'family@example.com', tokenExpiresAt: null };
    mockGoogleCreate.mockResolvedValue({ id: 'series-g1' });
    mockResults.push([google], [{ ...SERIES, id: 'new-1' }]);

    const res = await POST(new NextRequest('http://localhost/api/events', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Swim practice',
        startTime: '2026-11-03T23:00:00.000Z',
        endTime: '2026-11-04T00:00:00.000Z',
        calendarSourceId: '6f1c2a3e-0b4d-4e8f-9a7b-1c2d3e4f5a6b',
        recurring: true,
        recurrenceRule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=TU',
      }),
    }));

    expect(res.status).toBe(201);
    const [, calendarId, sent] = mockGoogleCreate.mock.calls[0]!;
    expect(calendarId).toBe('family@example.com');
    expect(sent).toMatchObject({
      start: { dateTime: '2026-11-03T23:00:00.000Z', timeZone: 'America/Chicago' },
      end: { dateTime: '2026-11-04T00:00:00.000Z', timeZone: 'America/Chicago' },
      recurrence: ['RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TU'],
    });
    expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({
      externalEventId: 'series-g1',
      recurrenceRule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=TU',
    }));
  });
});
