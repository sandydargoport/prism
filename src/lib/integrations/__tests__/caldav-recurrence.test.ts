/**
 * CalDAV recurrence expansion for series that began long before the sync
 * range (#533).
 *
 * Expansion used to stop after 100 instances counted from DTSTART, so a
 * weekly series from a few years back, or a daily one from a few months
 * back, used them up before the range and synced nothing.
 */
const mockFetchCalendarObjects = jest.fn();
jest.mock('tsdav', () => ({
  createDAVClient: jest.fn(async () => ({
    fetchCalendars: async () => [{ url: 'https://dav.example.com/cal/' }],
    fetchCalendarObjects: (...a: unknown[]) => mockFetchCalendarObjects(...a),
  })),
}));

import ICAL from 'ical.js';
import { fetchCalDAVEvents, icalTimeToDate } from '../caldav';

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

const starts = (evs: Array<{ startTime: Date }>) => evs.map((e) => e.startTime.toISOString());

/** Every instance from DTSTART, no shortcuts and no cap: the reference. */
function referenceStarts(data: string, rangeStart: Date, rangeEnd: Date): string[] {
  const comp = new ICAL.Component(ICAL.parse(data));
  const master = comp.getAllSubcomponents('vevent').find((v) => !v.hasProperty('recurrence-id'))!;
  const event = new ICAL.Event(master);
  const allDay = event.startDate.isDate;
  const iterator = event.iterator();
  const out: string[] = [];
  for (let next = iterator.next(); next; next = iterator.next()) {
    const occ = event.getOccurrenceDetails(next);
    const start = icalTimeToDate(occ.startDate, allDay, HOUSEHOLD);
    const end = icalTimeToDate(occ.endDate, allDay, HOUSEHOLD);
    if (start > rangeEnd) break;
    if (end >= rangeStart) out.push(start.toISOString());
  }
  return out;
}

describe('CalDAV recurring series that began long ago (#533)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('syncs the in-range instances of a weekly series from 2019', async () => {
    const evs = await read(calendar(vevent(
      'UID:weekly@example.com', 'DTSTART:20190107T170000Z', 'DTEND:20190107T180000Z',
      'RRULE:FREQ=WEEKLY', 'SUMMARY:Choir practice',
    )));
    expect(starts(evs)).toEqual([
      '2026-09-07T17:00:00.000Z',
      '2026-09-14T17:00:00.000Z',
      '2026-09-21T17:00:00.000Z',
      '2026-09-28T17:00:00.000Z',
    ]);
    expect(evs[0]!.uid).toBe('weekly@example.com_2026-09-07T17:00:00.000Z');
    expect(evs.every((e) => e.recurring && e.recurrenceRule === 'FREQ=WEEKLY')).toBe(true);
  });

  it('syncs every day of a daily series across a range longer than 100 days', async () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const end = new Date('2027-01-01T00:00:00Z');
    const evs = await read(calendar(vevent(
      'UID:daily@example.com', 'DTSTART:20200101T120000Z', 'DTEND:20200101T123000Z',
      'RRULE:FREQ=DAILY', 'SUMMARY:Feed the fish',
    )), start, end);
    expect(evs).toHaveLength(365);
    expect(evs[0]!.startTime.toISOString()).toBe('2026-01-01T12:00:00.000Z');
    expect(evs[364]!.startTime.toISOString()).toBe('2026-12-31T12:00:00.000Z');
  });

  it('yields nothing for a COUNT series that ended long ago', async () => {
    const evs = await read(calendar(vevent(
      'UID:count@example.com', 'DTSTART:20190107T170000Z', 'DTEND:20190107T180000Z',
      'RRULE:FREQ=WEEKLY;COUNT=10', 'SUMMARY:Ten lessons',
    )));
    expect(evs).toEqual([]);
  });

  it('counts COUNT from DTSTART when the series ends inside the range', async () => {
    const evs = await read(calendar(vevent(
      'UID:count2@example.com', 'DTSTART:20260803T170000Z', 'DTEND:20260803T180000Z',
      'RRULE:FREQ=WEEKLY;COUNT=6', 'SUMMARY:Six lessons',
    )));
    expect(starts(evs)).toEqual(['2026-09-07T17:00:00.000Z']);
  });

  it('stops at UNTIL', async () => {
    const evs = await read(calendar(vevent(
      'UID:until@example.com', 'DTSTART:20190107T170000Z', 'DTEND:20190107T180000Z',
      'RRULE:FREQ=WEEKLY;UNTIL=20260915T235959Z', 'SUMMARY:Until mid-month',
    )));
    expect(starts(evs)).toEqual(['2026-09-07T17:00:00.000Z', '2026-09-14T17:00:00.000Z']);
  });

  it('drops an EXDATE inside the range', async () => {
    const evs = await read(calendar(vevent(
      'UID:exdate@example.com', 'DTSTART:20190107T170000Z', 'DTEND:20190107T180000Z',
      'RRULE:FREQ=WEEKLY', 'EXDATE:20260914T170000Z', 'SUMMARY:Choir practice',
    )));
    expect(starts(evs)).toEqual([
      '2026-09-07T17:00:00.000Z',
      '2026-09-21T17:00:00.000Z',
      '2026-09-28T17:00:00.000Z',
    ]);
  });

  it('still reads an overridden instance of an old series', async () => {
    const evs = await read(calendar(
      vevent(
        'UID:override@example.com', 'DTSTART:20190107T170000Z', 'DTEND:20190107T180000Z',
        'RRULE:FREQ=WEEKLY', 'SUMMARY:Choir practice',
      ),
      vevent(
        'UID:override@example.com', 'RECURRENCE-ID:20260921T170000Z',
        'DTSTART:20260922T170000Z', 'DTEND:20260922T180000Z', 'SUMMARY:Choir practice (moved)',
      ),
    ));
    const moved = evs.find((e) => e.title === 'Choir practice (moved)');
    expect(moved?.startTime.toISOString()).toBe('2026-09-22T17:00:00.000Z');
    expect(starts(evs.filter((e) => e.recurring))).toContain('2026-09-28T17:00:00.000Z');
  });

  it('keeps an old all-day weekly series on UTC midnight of each date', async () => {
    const evs = await read(calendar(vevent(
      'UID:allday@example.com', 'DTSTART;VALUE=DATE:20180105', 'DTEND;VALUE=DATE:20180106',
      'RRULE:FREQ=WEEKLY', 'SUMMARY:Bin day',
    )));
    expect(starts(evs)).toEqual([
      '2026-09-04T00:00:00.000Z',
      '2026-09-11T00:00:00.000Z',
      '2026-09-18T00:00:00.000Z',
      '2026-09-25T00:00:00.000Z',
    ]);
    expect(evs.every((e) => e.allDay)).toBe(true);
    expect(evs[0]!.uid).toBe('allday@example.com_2026-09-04T00:00:00.000Z');
    expect(evs[0]!.endTime.toISOString()).toBe('2026-09-05T00:00:00.000Z');
  });

  it.each([
    ['with a VTIMEZONE', NEW_YORK_VTIMEZONE],
    ['without a VTIMEZONE', []],
  ])('keeps an old TZID series at its wall time across a DST change (%s)', async (_label, vtimezone) => {
    const evs = await read(calendar(vtimezone, vevent(
      'UID:tzid@example.com',
      'DTSTART;TZID=America/New_York:20170302T090000', 'DTEND;TZID=America/New_York:20170302T100000',
      'RRULE:FREQ=WEEKLY', 'SUMMARY:Standup',
    )), new Date('2026-10-20T00:00:00Z'), new Date('2026-11-15T00:00:00Z'));
    expect(starts(evs)).toEqual([
      '2026-10-22T13:00:00.000Z', // 09:00 EDT
      '2026-10-29T13:00:00.000Z',
      '2026-11-05T14:00:00.000Z', // 09:00 EST, after fall-back
      '2026-11-12T14:00:00.000Z',
    ]);
  });

  it.each([
    ['biweekly on two days', 'DTSTART:20180102T080000Z', 'DTEND:20180102T090000Z', 'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH'],
    ['weekly, DTSTART not on a BYDAY', 'DTSTART:20180101T080000Z', 'DTEND:20180101T090000Z', 'RRULE:FREQ=WEEKLY;BYDAY=WE,FR'],
    ['weekly, WKST=SU', 'DTSTART:20180107T080000Z', 'DTEND:20180107T090000Z', 'RRULE:FREQ=WEEKLY;INTERVAL=2;WKST=SU;BYDAY=SU,SA'],
    ['every third day', 'DTSTART:20180101T080000Z', 'DTEND:20180101T090000Z', 'RRULE:FREQ=DAILY;INTERVAL=3'],
    ['daily on weekdays', 'DTSTART:20180101T080000Z', 'DTEND:20180101T090000Z', 'RRULE:FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR'],
    ['a three-day weekly stay', 'DTSTART:20180826T080000Z', 'DTEND:20180829T080000Z', 'RRULE:FREQ=WEEKLY'],
    ['fortnightly all-day', 'DTSTART;VALUE=DATE:20170830', 'DTEND;VALUE=DATE:20170902', 'RRULE:FREQ=WEEKLY;INTERVAL=2'],
    ['floating weekly', 'DTSTART:20170302T090000', 'DTEND:20170302T100000', 'RRULE:FREQ=WEEKLY;BYDAY=TH,SA'],
    ['monthly', 'DTSTART:20100131T080000Z', 'DTEND:20100131T090000Z', 'RRULE:FREQ=MONTHLY;BYMONTHDAY=-1'],
  ])('matches a full expansion from DTSTART: %s', async (_label, dtstart, dtend, rrule) => {
    const data = calendar(NEW_YORK_VTIMEZONE, vevent('UID:ref@example.com', dtstart, dtend, rrule, 'SUMMARY:Reference'));
    const start = new Date('2026-08-30T00:00:00Z');
    const end = new Date('2026-11-30T00:00:00Z');
    const expected = referenceStarts(data, start, end);
    expect(expected.length).toBeGreaterThan(0);
    expect(starts(await read(data, start, end))).toEqual(expected);
  });

  it('bounds the work spent on a series too dense to walk', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const evs = await read(calendar(vevent(
      'UID:minutely@example.com', 'DTSTART:20260101T000000Z', 'DTEND:20260101T000100Z',
      'RRULE:FREQ=MINUTELY', 'SUMMARY:Too often',
    )));
    expect(evs).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
