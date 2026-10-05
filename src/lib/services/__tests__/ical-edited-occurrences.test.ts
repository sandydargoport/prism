/**
 * Edited occurrences in a subscribed iCal feed.
 *
 * node-ical does not return an edited occurrence (a VEVENT with RECURRENCE-ID)
 * as its own item: it files it under the master's `recurrences`, keyed by the
 * slot it replaces. The sync expanded the master's RRULE and never read that,
 * so an edited occurrence showed at its original time and title, and one
 * cancelled by an edit still showed.
 *
 * The feed is parsed by the real node-ical; only the fetch and the database
 * are mocked. Dates are built from today so they stay inside the sync window.
 */
const mockFindFirst = jest.fn();
const mockFindMany = jest.fn().mockResolvedValue([]);
const mockOnConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
const mockInsertValues = jest.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
const mockUpdateSet = jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) });
const mockFromURL = jest.fn();

jest.mock('@/lib/db/client', () => ({
  db: {
    query: {
      calendarSources: { findFirst: (...a: unknown[]) => mockFindFirst(...a), findMany: jest.fn() },
      events: { findMany: (...a: unknown[]) => mockFindMany(...a), findFirst: jest.fn() },
    },
    select: () => ({ from: () => ({ where: jest.fn().mockResolvedValue([]) }) }),
    insert: () => ({ values: mockInsertValues }),
    update: () => ({ set: mockUpdateSet }),
    delete: () => ({ where: jest.fn().mockResolvedValue(undefined) }),
  },
}));
jest.mock('@/lib/db/schema', () => ({
  calendarSources: { id: 'id', provider: 'provider', enabled: 'enabled' },
  events: { calendarSourceId: 'calendarSourceId', externalEventId: 'externalEventId', startTime: 'startTime', id: 'id', pendingDeletion: 'pendingDeletion' },
  dismissedEvents: { calendarSourceId: 'calendarSourceId', externalEventId: 'externalEventId' },
}));
jest.mock('@/lib/integrations/google-calendar', () => ({}));
jest.mock('@/lib/integrations/caldav', () => ({}));
jest.mock('@/lib/utils/crypto', () => ({ decrypt: (v: string) => v, encrypt: (v: string) => v }));
jest.mock('@/lib/householdTimezone', () => ({ getHouseholdTimezone: jest.fn().mockResolvedValue('UTC') }));
jest.mock('node-ical', () => {
  const actual = jest.requireActual('node-ical');
  return { ...actual, async: { ...actual.async, fromURL: (...a: unknown[]) => mockFromURL(...a) } };
});
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

import ical from 'node-ical';
import { zonedWallTimeToUtc } from '@/lib/utils/zonedDate';
import { syncIcalCalendarSource } from '../calendar-sync';

const DAY = 86_400_000;
// A Monday at 17:00 UTC, one to two weeks out.
const base = new Date(Date.now() + 7 * DAY);
base.setUTCDate(base.getUTCDate() + ((8 - base.getUTCDay()) % 7));
base.setUTCHours(17, 0, 0, 0);
const at = (days: number, hours = 0) => new Date(base.getTime() + days * DAY + hours * 3_600_000);
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const dateStamp = (d: Date) => stamp(d).slice(0, 8);

function feed(...vevents: string[][]): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', ...vevents.flatMap((v) => ['BEGIN:VEVENT', ...v, 'END:VEVENT']), 'END:VCALENDAR'].join('\r\n');
}

const MASTER = [
  'UID:swim@example.com', `DTSTART:${stamp(at(0))}`, `DTEND:${stamp(at(0, 1))}`,
  'RRULE:FREQ=WEEKLY;COUNT=4', 'SUMMARY:Swim practice', 'LOCATION:Pool',
];

async function sync(ics: string) {
  mockFindFirst.mockResolvedValue({ id: 'ical-1', provider: 'ical', icalUrl: 'https://example.com/c.ics', enabled: true });
  mockFromURL.mockResolvedValue(ical.sync.parseICS(ics));
  await syncIcalCalendarSource('ical-1');
  return mockInsertValues.mock.calls.map(([row]) => row as {
    externalEventId: string; title: string; location: string | null; startTime: Date; endTime: Date; seriesKey: string | null;
  });
}

beforeEach(() => jest.clearAllMocks());

describe('iCal feed: edited occurrences', () => {
  it('shows an edit at its new time with its own details, under its slot id', async () => {
    const rows = await sync(feed(MASTER, [
      'UID:swim@example.com', `RECURRENCE-ID:${stamp(at(7))}`,
      `DTSTART:${stamp(at(8, 2))}`, `DTEND:${stamp(at(8, 3))}`, 'SUMMARY:Swim practice (Tuesday)', 'LOCATION:Lake',
    ]));

    expect(rows).toHaveLength(4);
    const edited = rows.find((r) => r.externalEventId === `swim@example.com_${at(7).toISOString()}`);
    expect(edited).toMatchObject({ title: 'Swim practice (Tuesday)', location: 'Lake', seriesKey: 'swim@example.com' });
    expect(edited!.startTime.toISOString()).toBe(at(8, 2).toISOString());
    expect(edited!.endTime.toISOString()).toBe(at(8, 3).toISOString());
    // Nothing is left at the original slot's time, and the others are untouched.
    expect(rows.map((r) => r.startTime.toISOString())).not.toContain(at(7).toISOString());
    expect(rows.filter((r) => r.title === 'Swim practice')).toHaveLength(3);
    expect(rows.find((r) => r.externalEventId.endsWith(at(14).toISOString()))).toMatchObject({ location: 'Pool' });
  });

  it('drops an occurrence cancelled by an edit', async () => {
    const rows = await sync(feed(MASTER, [
      'UID:swim@example.com', `RECURRENCE-ID:${stamp(at(14))}`, 'STATUS:CANCELLED',
      `DTSTART:${stamp(at(14))}`, `DTEND:${stamp(at(14, 1))}`, 'SUMMARY:Swim practice',
    ]));
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.externalEventId)).not.toContain(`swim@example.com_${at(14).toISOString()}`);
  });

  it('applies an edit in a named zone to the right slot', async () => {
    // Wall-clock times, so the series keeps 13:00 New York time across a DST
    // change, as the RRULE does.
    const NY = 'America/New_York';
    const ymd = (d: Date) => d.toISOString().slice(0, 10);
    const wall = (d: Date, hhmm: string) => `${ymd(d).replace(/-/g, '')}T${hhmm.replace(':', '')}00`;
    const rows = await sync(feed([
      'UID:piano@example.com', `DTSTART;TZID=${NY}:${wall(at(0), '13:00')}`,
      `DTEND;TZID=${NY}:${wall(at(0), '14:00')}`, 'RRULE:FREQ=WEEKLY;COUNT=3', 'SUMMARY:Piano',
    ], [
      'UID:piano@example.com', `RECURRENCE-ID;TZID=${NY}:${wall(at(7), '13:00')}`,
      `DTSTART;TZID=${NY}:${wall(at(7), '14:00')}`, `DTEND;TZID=${NY}:${wall(at(7), '15:00')}`,
      'SUMMARY:Piano (an hour late)',
    ]));
    expect(rows).toHaveLength(3);
    const edited = rows.find((r) => r.title === 'Piano (an hour late)');
    expect(edited).toMatchObject({
      externalEventId: `piano@example.com_${zonedWallTimeToUtc(ymd(at(7)), '13:00', NY).toISOString()}`,
    });
    expect(edited!.startTime.toISOString()).toBe(zonedWallTimeToUtc(ymd(at(7)), '14:00', NY).toISOString());
  });

  it('applies an edit to an all-day series, keyed on the slot date', async () => {
    const rows = await sync(feed([
      'UID:bins@example.com', `DTSTART;VALUE=DATE:${dateStamp(at(0))}`, `DTEND;VALUE=DATE:${dateStamp(at(1))}`,
      'RRULE:FREQ=WEEKLY;COUNT=3', 'SUMMARY:Bin day',
    ], [
      'UID:bins@example.com', `RECURRENCE-ID;VALUE=DATE:${dateStamp(at(7))}`,
      `DTSTART;VALUE=DATE:${dateStamp(at(8))}`, `DTEND;VALUE=DATE:${dateStamp(at(9))}`, 'SUMMARY:Bin day (holiday)',
    ]));
    expect(rows).toHaveLength(3);
    const day = (d: Date) => `${d.toISOString().slice(0, 10)}T00:00:00.000Z`;
    const edited = rows.find((r) => r.title === 'Bin day (holiday)');
    expect(edited).toMatchObject({ externalEventId: `bins@example.com_${day(at(7))}` });
    expect(edited!.startTime.toISOString()).toBe(day(at(8)));
    expect(edited!.endTime.toISOString()).toBe(day(at(9)));
  });

  it('includes an edit moved into the window from a slot beyond it', async () => {
    // The sync reaches two years ahead; this slot is three years out.
    const farSlot = at(7 * 52 * 3);
    const rows = await sync(feed([
      'UID:club@example.com', `DTSTART:${stamp(at(0))}`, `DTEND:${stamp(at(0, 1))}`,
      'RRULE:FREQ=WEEKLY', 'SUMMARY:Book club',
    ], [
      'UID:club@example.com', `RECURRENCE-ID:${stamp(farSlot)}`,
      `DTSTART:${stamp(at(3))}`, `DTEND:${stamp(at(3, 1))}`, 'SUMMARY:Book club (brought forward)',
    ]));
    const moved = rows.find((r) => r.title === 'Book club (brought forward)');
    expect(moved).toMatchObject({ externalEventId: `club@example.com_${farSlot.toISOString()}` });
    expect(moved!.startTime.toISOString()).toBe(at(3).toISOString());
  });

  it('leaves a series with no edits exactly as before', async () => {
    const rows = await sync(feed(MASTER));
    expect(rows.map((r) => r.externalEventId)).toEqual(
      [0, 7, 14, 21].map((d) => `swim@example.com_${at(d).toISOString()}`),
    );
    expect(rows.every((r) => r.title === 'Swim practice' && r.location === 'Pool')).toBe(true);
  });
});
