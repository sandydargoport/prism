/**
 * Where a CalDAV VEVENT's times land, whatever zone the server runs in.
 *
 * ical.js reads a floating time (no TZID, no Z), and a TZID the object has no
 * VTIMEZONE for, in the process zone. On a default Docker install that is
 * UTC, so a floating 09:00 event showed at 04:00 in Chicago. Recurring
 * all-day instances were also keyed on server-local midnight, so their ids
 * changed with the server's zone.
 */
const mockFetchCalendarObjects = jest.fn();
jest.mock('tsdav', () => ({
  createDAVClient: jest.fn(async () => ({
    fetchCalendars: async () => [{ url: 'https://dav.example.com/cal/' }],
    fetchCalendarObjects: (...a: unknown[]) => mockFetchCalendarObjects(...a),
  })),
}));

import { fetchCalDAVEvents } from '../caldav';

const CAL = 'https://dav.example.com/cal/';

function ics(...lines: string[]): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', ...lines, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}

async function read(data: string, timeZone = 'America/Chicago', timeMax = new Date('2026-10-15T00:00:00Z')) {
  mockFetchCalendarObjects.mockResolvedValue([{ url: `${CAL}e.ics`, etag: '"1"', data }]);
  return fetchCalDAVEvents(
    'https://dav.example.com', 'user', 'pass', CAL,
    new Date('2026-09-01T00:00:00Z'), timeMax, timeZone,
  );
}

describe('CalDAV VEVENT times', () => {
  it('reads a floating time as a wall time in the household zone', async () => {
    const [ev] = await read(ics('UID:f@example.com', 'DTSTART:20260910T090000', 'DTEND:20260910T100000', 'SUMMARY:Floating'));
    expect(ev!.startTime.toISOString()).toBe('2026-09-10T14:00:00.000Z'); // 09:00 CDT
    expect(ev!.endTime.toISOString()).toBe('2026-09-10T15:00:00.000Z');
  });

  it('reads a TZID with no VTIMEZONE in that zone, not the server\'s', async () => {
    const [ev] = await read(ics(
      'UID:t@example.com', 'DTSTART;TZID=Asia/Tokyo:20260910T090000', 'DTEND;TZID=Asia/Tokyo:20260910T100000', 'SUMMARY:Tokyo',
    ));
    expect(ev!.startTime.toISOString()).toBe('2026-09-10T00:00:00.000Z'); // 09:00 JST
  });

  it('keeps a UTC time as that instant', async () => {
    const [ev] = await read(ics('UID:u@example.com', 'DTSTART:20260910T090000Z', 'DTEND:20260910T100000Z', 'SUMMARY:UTC'));
    expect(ev!.startTime.toISOString()).toBe('2026-09-10T09:00:00.000Z');
  });

  it('expands a floating weekly series at the household wall time across DST', async () => {
    const wide = await read(ics(
      'UID:w@example.com', 'DTSTART:20261029T090000', 'DTEND:20261029T093000', 'RRULE:FREQ=WEEKLY;COUNT=2', 'SUMMARY:Weekly',
    ), 'America/Chicago', new Date('2026-11-30T00:00:00Z'));
    expect(wide.map((e) => e.startTime.toISOString())).toEqual([
      '2026-10-29T14:00:00.000Z', // 09:00 CDT
      '2026-11-05T15:00:00.000Z', // 09:00 CST, after fall-back
    ]);
    expect(wide[0]!.uid).toBe('w@example.com_2026-10-29T14:00:00.000Z');
  });

  it('keys a recurring all-day instance on its date, and reports the older id when it differs', async () => {
    const evs = await read(ics(
      'UID:a@example.com', 'DTSTART;VALUE=DATE:20260907', 'DTEND;VALUE=DATE:20260908', 'RRULE:FREQ=WEEKLY;COUNT=1', 'SUMMARY:Bins',
    ));
    expect(evs[0]!.uid).toBe('a@example.com_2026-09-07T00:00:00.000Z');
    expect(evs[0]!.startTime.toISOString()).toBe('2026-09-07T00:00:00.000Z');
    // The older id was server-local midnight: the same string on a UTC server.
    const serverMidnight = new Date(2026, 8, 7).toISOString();
    if (serverMidnight === '2026-09-07T00:00:00.000Z') {
      expect(evs[0]!.legacyUid).toBeUndefined();
    } else {
      expect(evs[0]!.legacyUid).toBe(`a@example.com_${serverMidnight}`);
    }
  });
});
