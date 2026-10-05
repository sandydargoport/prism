/**
 * Edited occurrences of a recurring CalDAV event (#593), and the series key
 * that lets Prism hide a whole series (#592).
 *
 * An edited occurrence is its own VEVENT with the master's UID and a
 * RECURRENCE-ID naming the slot it replaces. Prism used to expand the master
 * as if nothing had changed and store each edit separately under the bare
 * UID, so the original slot and the edit both showed, and every edit of one
 * series collided on that single id.
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
const HOUSEHOLD = 'America/New_York';
const SEPT_START = new Date('2026-09-01T00:00:00Z');
const SEPT_END = new Date('2026-10-01T00:00:00Z');

const NEW_YORK_VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:America/New_York',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:-0500',
  'TZOFFSETTO:-0400',
  'TZNAME:EDT',
  'DTSTART:19700308T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:-0400',
  'TZOFFSETTO:-0500',
  'TZNAME:EST',
  'DTSTART:19701101T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

function vevent(...lines: string[]): string[] {
  return ['BEGIN:VEVENT', ...lines, 'END:VEVENT'];
}

function calendar(...parts: string[][]): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', ...parts.flat(), 'END:VCALENDAR'].join('\r\n');
}

async function read(data: string, start = SEPT_START, end = SEPT_END) {
  mockFetchCalendarObjects.mockResolvedValue([{ url: `${CAL}e.ics`, etag: '"1"', data }]);
  return fetchCalDAVEvents('https://dav.example.com', 'user', 'pass', CAL, start, end, HOUSEHOLD);
}

// Mondays in September 2026 at 17:00 UTC.
const MASTER = vevent(
  'UID:swim@example.com', 'DTSTART:20260907T170000Z', 'DTEND:20260907T180000Z',
  'RRULE:FREQ=WEEKLY;COUNT=4', 'SUMMARY:Swim practice',
);

describe('CalDAV edited occurrences (#593)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('replaces the edited slot instead of showing it twice', async () => {
    const evs = await read(calendar(MASTER, vevent(
      'UID:swim@example.com', 'RECURRENCE-ID:20260914T170000Z',
      'DTSTART:20260915T190000Z', 'DTEND:20260915T200000Z', 'SUMMARY:Swim practice (Tuesday)',
      'LOCATION:Main pool',
    )));

    expect(evs).toHaveLength(4);
    expect(evs.map((e) => e.startTime.toISOString())).toEqual([
      '2026-09-07T17:00:00.000Z',
      '2026-09-15T19:00:00.000Z',
      '2026-09-21T17:00:00.000Z',
      '2026-09-28T17:00:00.000Z',
    ]);
    const edited = evs[1]!;
    expect(edited).toMatchObject({
      uid: 'swim@example.com_2026-09-14T17:00:00.000Z',
      title: 'Swim practice (Tuesday)',
      location: 'Main pool',
      recurring: true,
      seriesKey: 'swim@example.com',
      // Renames the row older builds stored the edit under.
      legacyUid: 'swim@example.com',
    });
    expect(edited.endTime.toISOString()).toBe('2026-09-15T20:00:00.000Z');
  });

  it('gives every edited occurrence of one series its own id', async () => {
    const evs = await read(calendar(
      MASTER,
      vevent('UID:swim@example.com', 'RECURRENCE-ID:20260914T170000Z',
        'DTSTART:20260914T180000Z', 'DTEND:20260914T190000Z', 'SUMMARY:Swim practice (late)'),
      vevent('UID:swim@example.com', 'RECURRENCE-ID:20260921T170000Z',
        'DTSTART:20260921T160000Z', 'DTEND:20260921T170000Z', 'SUMMARY:Swim practice (early)'),
    ));
    const uids = evs.map((e) => e.uid);
    expect(new Set(uids).size).toBe(uids.length);
    expect(uids).toEqual([
      'swim@example.com_2026-09-07T17:00:00.000Z',
      'swim@example.com_2026-09-14T17:00:00.000Z',
      'swim@example.com_2026-09-21T17:00:00.000Z',
      'swim@example.com_2026-09-28T17:00:00.000Z',
    ]);
  });

  it('keys an unedited occurrence exactly as before', async () => {
    const evs = await read(calendar(MASTER));
    expect(evs[0]).toMatchObject({ uid: 'swim@example.com_2026-09-07T17:00:00.000Z', seriesKey: 'swim@example.com' });
    expect(evs[0]!.legacyUid).toBeUndefined();
  });

  it('matches an edit to its slot in a named zone', async () => {
    const evs = await read(calendar(NEW_YORK_VTIMEZONE, vevent(
      'UID:piano@example.com', 'DTSTART;TZID=America/New_York:20260903T160000',
      'DTEND;TZID=America/New_York:20260903T170000', 'RRULE:FREQ=WEEKLY;COUNT=4', 'SUMMARY:Piano',
    ), vevent(
      'UID:piano@example.com', 'RECURRENCE-ID;TZID=America/New_York:20260910T160000',
      'DTSTART;TZID=America/New_York:20260910T163000', 'DTEND;TZID=America/New_York:20260910T173000',
      'SUMMARY:Piano (half hour late)',
    )));
    expect(evs).toHaveLength(4);
    const edited = evs.find((e) => e.title === 'Piano (half hour late)');
    expect(edited).toMatchObject({ uid: 'piano@example.com_2026-09-10T20:00:00.000Z' });
    expect(edited!.startTime.toISOString()).toBe('2026-09-10T20:30:00.000Z');
  });

  it('drops a cancelled occurrence', async () => {
    const evs = await read(calendar(MASTER, vevent(
      'UID:swim@example.com', 'RECURRENCE-ID:20260921T170000Z', 'STATUS:CANCELLED',
      'DTSTART:20260921T170000Z', 'DTEND:20260921T180000Z', 'SUMMARY:Swim practice',
    )));
    expect(evs.map((e) => e.startTime.toISOString())).not.toContain('2026-09-21T17:00:00.000Z');
    expect(evs).toHaveLength(3);
  });

  it('keeps expanding past an edit moved beyond the range', async () => {
    const evs = await read(calendar(MASTER, vevent(
      'UID:swim@example.com', 'RECURRENCE-ID:20260914T170000Z',
      'DTSTART:20261020T170000Z', 'DTEND:20261020T180000Z', 'SUMMARY:Swim practice (postponed)',
    )));
    expect(evs.map((e) => e.startTime.toISOString())).toEqual([
      '2026-09-07T17:00:00.000Z',
      '2026-09-21T17:00:00.000Z',
      '2026-09-28T17:00:00.000Z',
    ]);
  });

  it('keys an edit that arrives without its master on its slot', async () => {
    const evs = await read(calendar(vevent(
      'UID:swim@example.com', 'RECURRENCE-ID:20260914T170000Z',
      'DTSTART:20260915T190000Z', 'DTEND:20260915T200000Z', 'SUMMARY:Swim practice (Tuesday)',
    )));
    expect(evs).toEqual([expect.objectContaining({
      uid: 'swim@example.com_2026-09-14T17:00:00.000Z',
      legacyUid: 'swim@example.com',
      recurring: true,
      seriesKey: 'swim@example.com',
    })]);
  });

  it('leaves a single event out of any series', async () => {
    const evs = await read(calendar(vevent(
      'UID:dentist@example.com', 'DTSTART:20260910T140000Z', 'DTEND:20260910T150000Z', 'SUMMARY:Dentist',
    )));
    expect(evs).toEqual([expect.objectContaining({ uid: 'dentist@example.com', recurring: false, seriesKey: null })]);
  });
});
