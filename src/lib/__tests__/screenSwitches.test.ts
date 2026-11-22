/**
 * A screen's dashboard and its switches (#1282): which dashboard a screen
 * shows at a moment, read on the household's wall clock. At bus time is from
 * 30 minutes before a route's time at the stop to 15 after, on the route's
 * days, unless the switch has routes and minutes of its own (#1291); set
 * times cover their days and hours, past midnight included. The first switch
 * that matches wins, and one whose dashboard is gone is skipped.
 */
import {
  busTimeAt,
  daysShort,
  MAX_SWITCHES,
  parseSwitches,
  samePlan,
  screenDashboardAt,
  screenShows,
  switchAt,
  switchesSchema,
  switchInWords,
  timesCover,
  type ScreenSwitch,
  type TimesSwitch,
} from '../screenSwitches';

const SCHOOL = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NIGHT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const KITCHEN = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const WEEKDAYS = [1, 2, 3, 4, 5];
const CHICAGO = 'America/Chicago';

// 2026-11-02 is a Monday. Chicago is UTC-6 from 2026-11-01 (DST ends).
const chicago = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00-06:00`);

const morning: TimesSwitch = { when: 'times', days: WEEKDAYS, from: '07:00', to: '07:45', dashboardId: SCHOOL };
const night: TimesSwitch = { when: 'times', days: [5, 6], from: '22:00', to: '06:00', dashboardId: NIGHT };
const bus: ScreenSwitch = { when: 'bus', dashboardId: SCHOOL };
const AM = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const PM = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
/** A morning run due at the stop at 7:45 and an afternoon one at 3:30, on weekdays. */
const ROUTES = [
  { id: AM, scheduledTime: '07:45', activeDays: WEEKDAYS },
  { id: PM, scheduledTime: '15:30', activeDays: WEEKDAYS },
];

describe('at bus time', () => {
  it('is 30 minutes before a route\'s time to 15 after, both ends included', () => {
    const at = (hhmm: string) => busTimeAt(ROUTES, chicago('2026-11-02', hhmm), CHICAGO);
    expect(at('07:14')).toBe(false);
    expect(at('07:15')).toBe(true);
    expect(at('07:45')).toBe(true);
    expect(at('08:00')).toBe(true);
    expect(at('08:01')).toBe(false);
    // The afternoon run too, from 3:00 to 3:45.
    expect(at('14:59')).toBe(false);
    expect(at('15:00')).toBe(true);
    expect(at('15:45')).toBe(true);
    expect(at('15:46')).toBe(false);
    expect(at('12:00')).toBe(false);
  });

  it('only on the route\'s days, on the household\'s calendar', () => {
    // Saturday 7:30: no route runs.
    expect(busTimeAt(ROUTES, chicago('2026-11-07', '07:30'), CHICAGO)).toBe(false);
    // Monday 7:30 in Chicago, but read in Tokyo it is Monday night: not bus time.
    expect(busTimeAt(ROUTES, chicago('2026-11-02', '07:30'), 'Asia/Tokyo')).toBe(false);
    expect(busTimeAt(ROUTES, chicago('2026-11-02', '07:30'), CHICAGO)).toBe(true);
  });

  it('follows a route whose time changes, with nothing retyped', () => {
    const later = [{ scheduledTime: '08:15', activeDays: WEEKDAYS }];
    expect(busTimeAt(later, chicago('2026-11-02', '07:30'), CHICAGO)).toBe(false);
    expect(busTimeAt(later, chicago('2026-11-02', '08:20'), CHICAGO)).toBe(true);
  });

  it('with no routes it is never bus time', () => {
    expect(busTimeAt([], chicago('2026-11-02', '07:30'), CHICAGO)).toBe(false);
    expect(switchAt([bus], chicago('2026-11-02', '07:30'), CHICAGO)).toEqual({ index: -1, dashboardId: null });
  });
});

describe('a bus switch with routes and minutes of its own (#1291)', () => {
  const at = (sw: ScreenSwitch, hhmm: string) => switchAt([sw], chicago('2026-11-02', hhmm), CHICAGO, ROUTES).dashboardId;

  it('from 10 minutes before to 5 after, both ends included', () => {
    const close: ScreenSwitch = { ...bus, before: 10, after: 5 };
    expect(at(close, '07:34')).toBeNull();
    expect(at(close, '07:35')).toBe(SCHOOL);
    expect(at(close, '07:50')).toBe(SCHOOL);
    expect(at(close, '07:51')).toBeNull();
    // One with no minutes of its own: 30 and 15.
    expect(at(bus, '07:15')).toBe(SCHOOL);
    expect(at(bus, '08:00')).toBe(SCHOOL);
  });

  it('follows only the routes it names, and every route when it names none', () => {
    const morningOnly: ScreenSwitch = { ...bus, routeIds: [AM] };
    expect(at(morningOnly, '07:30')).toBe(SCHOOL);
    expect(at(morningOnly, '15:15')).toBeNull();
    expect(at(bus, '15:15')).toBe(SCHOOL);
  });

  it('two bus switches: the morning run to one dashboard, the afternoon to another', () => {
    const both: ScreenSwitch[] = [{ ...bus, routeIds: [AM] }, { when: 'bus', dashboardId: NIGHT, routeIds: [PM] }];
    expect(switchAt(both, chicago('2026-11-02', '07:30'), CHICAGO, ROUTES)).toEqual({ index: 0, dashboardId: SCHOOL });
    expect(switchAt(both, chicago('2026-11-02', '15:15'), CHICAGO, ROUTES)).toEqual({ index: 1, dashboardId: NIGHT });
  });

  it('one whose routes are all gone never switches', () => {
    expect(at({ ...bus, routeIds: ['ffffffff-ffff-4fff-8fff-ffffffffffff'] }, '07:30')).toBeNull();
  });
});

describe('at set times', () => {
  it('includes the first minute and excludes the last', () => {
    expect(timesCover(morning, 1, 6 * 60 + 59)).toBe(false);
    expect(timesCover(morning, 1, 7 * 60)).toBe(true);
    expect(timesCover(morning, 1, 7 * 60 + 44)).toBe(true);
    expect(timesCover(morning, 1, 7 * 60 + 45)).toBe(false);
  });

  it('on several days covers each of them, and only those', () => {
    for (const d of WEEKDAYS) expect(timesCover(morning, d, 7 * 60 + 10)).toBe(true);
    expect(timesCover(morning, 0, 7 * 60 + 10)).toBe(false);
    expect(timesCover(morning, 6, 7 * 60 + 10)).toBe(false);
  });

  it('one past midnight runs into the next morning of the day it starts on', () => {
    expect(timesCover(night, 5, 23 * 60)).toBe(true);
    expect(timesCover(night, 6, 5 * 60 + 59)).toBe(true);
    expect(timesCover(night, 6, 6 * 60)).toBe(false);
    // Sunday morning belongs to Saturday night's; Monday morning to nothing.
    expect(timesCover(night, 0, 3 * 60)).toBe(true);
    expect(timesCover(night, 1, 3 * 60)).toBe(false);
    expect(timesCover(night, 4, 23 * 60)).toBe(false);
  });

  it('equal start and end is the whole day', () => {
    const allDay = { days: [0, 6], from: '00:00', to: '00:00' };
    expect(timesCover(allDay, 6, 0)).toBe(true);
    expect(timesCover(allDay, 6, 23 * 60 + 59)).toBe(true);
    expect(timesCover(allDay, 1, 12 * 60)).toBe(false);
  });

  it('reads the household wall clock, not UTC', () => {
    expect(switchAt([morning], chicago('2026-11-02', '07:10'), CHICAGO)).toEqual({ index: 0, dashboardId: SCHOOL });
    expect(switchAt([morning], chicago('2026-11-02', '07:10'), 'UTC')).toEqual({ index: -1, dashboardId: null });
  });
});

describe('which dashboard a screen shows', () => {
  const kitchen = { dashboardId: KITCHEN, switches: [bus, night] };
  const shows = (at: Date, exists?: (id: string) => boolean) => screenDashboardAt(kitchen, at, CHICAGO, ROUTES, exists);

  it('its own, the bus dashboard at bus time morning and afternoon, its own again after', () => {
    expect(shows(chicago('2026-11-02', '07:10'))).toBe(KITCHEN);
    expect(shows(chicago('2026-11-02', '07:30'))).toBe(SCHOOL);
    expect(shows(chicago('2026-11-02', '08:05'))).toBe(KITCHEN);
    expect(shows(chicago('2026-11-02', '15:10'))).toBe(SCHOOL);
    expect(shows(chicago('2026-11-02', '17:00'))).toBe(KITCHEN);
    // Friday night: the set-times switch.
    expect(shows(chicago('2026-11-06', '23:30'))).toBe(NIGHT);
  });

  it('the first switch that matches wins', () => {
    const early: TimesSwitch = { when: 'times', days: WEEKDAYS, from: '06:30', to: '08:00', dashboardId: NIGHT };
    const at = chicago('2026-11-02', '07:30');
    expect(switchAt([bus, early], at, CHICAGO, ROUTES)).toEqual({ index: 0, dashboardId: SCHOOL });
    expect(switchAt([early, bus], at, CHICAGO, ROUTES)).toEqual({ index: 0, dashboardId: NIGHT });
  });

  it('skips a switch whose dashboard is gone, and its own falls back to the default', () => {
    const at = chicago('2026-11-02', '07:30');
    expect(shows(at, (id) => id !== SCHOOL)).toBe(KITCHEN);
    expect(shows(at, () => false)).toBeNull();
    expect(screenDashboardAt({ dashboardId: null, switches: [] }, at, CHICAGO)).toBeNull();
  });

  it('screenShows: its own, the default when it has none, or one it switches to', () => {
    expect(screenShows(kitchen, { id: KITCHEN, isDefault: false })).toBe(true);
    expect(screenShows(kitchen, { id: SCHOOL, isDefault: false })).toBe(true);
    expect(screenShows(kitchen, { id: 'other', isDefault: true })).toBe(false);
    expect(screenShows({ dashboardId: null, switches: [] }, { id: 'other', isDefault: true })).toBe(true);
  });

  it('samePlan', () => {
    expect(samePlan(kitchen, { dashboardId: KITCHEN, switches: [bus, night] })).toBe(true);
    expect(samePlan(kitchen, { dashboardId: KITCHEN, switches: [night, bus] })).toBe(false);
    expect(samePlan({ dashboardId: null, switches: [] }, { dashboardId: KITCHEN, switches: [] })).toBe(false);
  });
});

describe('stored and sent', () => {
  it('reads what it can, drops the rest, and keeps at most twelve', () => {
    expect(parseSwitches([
      bus,
      { when: 'times', days: [1, 1, 9], from: '07:00', to: '08:00', dashboardId: SCHOOL },
      { when: 'times', days: [], from: '07:00', to: '08:00', dashboardId: SCHOOL },
      { when: 'later', dashboardId: SCHOOL },
      { when: 'bus' },
      'nonsense',
    ])).toEqual([bus, { when: 'times', days: [1], from: '07:00', to: '08:00', dashboardId: SCHOOL }]);
    expect(parseSwitches(null)).toEqual([]);
    // A bus switch's routes and minutes (#1291): repeats and non-ids out, minutes past two hours out, none named is every route.
    expect(parseSwitches([
      { when: 'bus', dashboardId: SCHOOL, routeIds: [AM, AM, 3], before: 10, after: 500 },
      { when: 'bus', dashboardId: SCHOOL, routeIds: [], before: -5, after: 0 },
    ])).toEqual([
      { when: 'bus', dashboardId: SCHOOL, routeIds: [AM], before: 10 },
      { when: 'bus', dashboardId: SCHOOL, after: 0 },
    ]);
    expect(parseSwitches(Array.from({ length: 20 }, () => bus))).toHaveLength(MAX_SWITCHES);
  });

  it('a change is checked before it is kept', () => {
    expect(switchesSchema.safeParse([bus, morning]).success).toBe(true);
    expect(switchesSchema.safeParse([{ ...morning, from: '25:00' }]).success).toBe(false);
    expect(switchesSchema.safeParse([{ when: 'bus', dashboardId: 'not-an-id' }]).success).toBe(false);
    expect(switchesSchema.safeParse([{ ...bus, extra: 1 }]).success).toBe(false);
    expect(switchesSchema.safeParse([{ ...bus, routeIds: [AM], before: 0, after: 120 }]).success).toBe(true);
    expect(switchesSchema.safeParse([{ ...bus, before: 121 }]).success).toBe(false);
    expect(switchesSchema.safeParse([{ ...bus, after: 2.5 }]).success).toBe(false);
    expect(switchesSchema.safeParse([{ ...bus, routeIds: ['morning'] }]).success).toBe(false);
    expect(switchesSchema.safeParse([{ ...bus, routeIds: [] }]).success).toBe(false);
    expect(switchesSchema.safeParse(Array.from({ length: MAX_SWITCHES + 1 }, () => bus)).success).toBe(false);
  });
});

describe('in words', () => {
  it('days read as days, Monday first', () => {
    expect(daysShort([1, 2, 3, 4, 5])).toBe('Mon–Fri');
    expect(daysShort([6, 0])).toBe('Sat, Sun');
    expect(daysShort([0, 1, 2, 3, 4, 5, 6])).toBe('Every day');
    expect(daysShort([1, 3, 5])).toBe('Mon, Wed, Fri');
  });

  it('a switch, for the summary line', () => {
    expect(switchInWords(bus, 'School run', (t) => t)).toBe('School run at bus time');
    expect(switchInWords(morning, 'School run', (t) => t)).toBe('School run Mon–Fri 07:00 to 07:45');
  });
});
