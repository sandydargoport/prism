/**
 * All-day CalDAV events under a non-UTC server timezone (#518).
 *
 * ical.js builds VALUE=DATE values at server-local midnight. Prism stores
 * all-day ranges as floating UTC midnights with an exclusive end, so the read
 * path converts and the write path must read the UTC fields back. Jest
 * sandboxes process.env, so the zone is the runner's; `npm run test:tz`
 * repeats this suite in zones on both sides of UTC.
 */

const mockFetchCalendarObjects = jest.fn();
const mockCreateCalendarObject = jest.fn();
jest.mock('tsdav', () => ({
  createDAVClient: jest.fn(async () => ({
    fetchCalendars: async () => [{ url: 'https://dav.example.com/cal/' }],
    fetchCalendarObjects: (...a: unknown[]) => mockFetchCalendarObjects(...a),
    createCalendarObject: (...a: unknown[]) => mockCreateCalendarObject(...a),
  })),
}));

import { fetchCalDAVEvents, createCalDAVEvent } from '../caldav';
import { eventOccursOnDisplayDay } from '@/lib/utils/timeFormat';

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const CAL = 'https://dav.example.com/cal/';

const ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:one-day@example.com',
  'DTSTART;VALUE=DATE:20260906',
  'DTEND;VALUE=DATE:20260907',
  'SUMMARY:Sample birthday',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

async function readEvents() {
  return fetchCalDAVEvents(
    'https://dav.example.com', 'user', 'pass', CAL,
    new Date('2026-08-01T00:00:00Z'), new Date('2026-10-01T00:00:00Z'),
  );
}

describe(`CalDAV all-day dates in the runner's zone (${tz})`, () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchCalendarObjects.mockResolvedValue([{ url: `${CAL}one-day.ics`, etag: '"1"', data: ICS }]);
    mockCreateCalendarObject.mockResolvedValue({ ok: true, headers: new Headers() });
  });

  it('reads a one-day VALUE=DATE event as a floating UTC-midnight range', async () => {
    const [ev] = await readEvents();
    expect(ev!.allDay).toBe(true);
    expect(ev!.startTime.toISOString()).toBe('2026-09-06T00:00:00.000Z');
    expect(ev!.endTime.toISOString()).toBe('2026-09-07T00:00:00.000Z');
    const on = (d: number) => eventOccursOnDisplayDay(ev!.startTime, ev!.endTime, true, new Date(2026, 8, d), tz);
    expect([on(5), on(6), on(7)]).toEqual([false, true, false]);
  });

  it('writes the same dates back that it read', async () => {
    const [ev] = await readEvents();
    await createCalDAVEvent('https://dav.example.com', 'user', 'pass', CAL, {
      uid: 'one-day@example.com',
      title: ev!.title,
      startTime: ev!.startTime,
      endTime: ev!.endTime,
      allDay: true,
    });
    const { iCalString } = mockCreateCalendarObject.mock.calls[0]![0] as { iCalString: string };
    expect(iCalString).toContain('DTSTART;VALUE=DATE:20260906');
    expect(iCalString).toContain('DTEND;VALUE=DATE:20260907');
  });
});
