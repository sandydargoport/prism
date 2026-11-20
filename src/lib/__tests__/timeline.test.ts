/**
 * Timelines (#1266): which dashboard a screen shows at a given moment comes
 * from the timeline it picked, read on the household's wall clock. Screens
 * on one timeline change together; screens on different ones show different
 * dashboards at the same moment. A duplicate starts equal and then goes its
 * own way, and a screen on a deleted timeline follows the household's first.
 */
import {
  copyName,
  daysInWords,
  duplicateOf,
  firstTimeline,
  MAX_PLACEMENTS,
  parsePlacements,
  placementAt,
  placementCovers,
  timelineDashboardAt,
  timelineFor,
  timelinePatchSchema,
  timelineShows,
  type Placement,
  type Timeline,
} from '../timeline';

const MORNING = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NIGHT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const KITCHEN = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const HALL = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const WEEKDAYS = [1, 2, 3, 4, 5];
const CHICAGO = 'America/Chicago';

const morning: Placement = { days: WEEKDAYS, from: '07:00', to: '07:45', dashboardId: MORNING };
const night: Placement = { days: [5, 6], from: '22:00', to: '06:00', dashboardId: NIGHT };

// 2026-11-02 is a Monday. Chicago is UTC-6 from 2026-11-01 (DST ends).
const chicago = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00-06:00`);

const timeline = (id: string, position: number, over: Partial<Timeline> = {}): Timeline => ({
  id, name: id, position, dashboardId: KITCHEN, placements: [], idleBackground: { source: 'dashboard' }, ...over,
});

describe('placementCovers', () => {
  it('includes the first minute and excludes the last', () => {
    expect(placementCovers(morning, 1, 6 * 60 + 59)).toBe(false);
    expect(placementCovers(morning, 1, 7 * 60)).toBe(true);
    expect(placementCovers(morning, 1, 7 * 60 + 44)).toBe(true);
    expect(placementCovers(morning, 1, 7 * 60 + 45)).toBe(false);
  });

  it('a placement on several days covers each of them, and only those', () => {
    for (const d of WEEKDAYS) expect(placementCovers(morning, d, 7 * 60 + 10)).toBe(true);
    expect(placementCovers(morning, 0, 7 * 60 + 10)).toBe(false);
    expect(placementCovers(morning, 6, 7 * 60 + 10)).toBe(false);
  });

  it('one past midnight runs into the next morning of the day it starts on', () => {
    // Friday 23:00 and Saturday 05:59 belong to Friday's placement.
    expect(placementCovers(night, 5, 23 * 60)).toBe(true);
    expect(placementCovers(night, 6, 5 * 60 + 59)).toBe(true);
    expect(placementCovers(night, 6, 6 * 60)).toBe(false);
    // Sunday morning belongs to Saturday night's; Monday morning to nothing.
    expect(placementCovers(night, 0, 3 * 60)).toBe(true);
    expect(placementCovers(night, 1, 3 * 60)).toBe(false);
    // Thursday night is not on it.
    expect(placementCovers(night, 4, 23 * 60)).toBe(false);
    expect(placementCovers(night, 5, 3 * 60)).toBe(false);
  });

  it('equal start and end is the whole day', () => {
    const allDay: Placement = { days: [0, 6], from: '00:00', to: '00:00', dashboardId: NIGHT };
    expect(placementCovers(allDay, 6, 0)).toBe(true);
    expect(placementCovers(allDay, 6, 23 * 60 + 59)).toBe(true);
    expect(placementCovers(allDay, 1, 12 * 60)).toBe(false);
  });
});

describe('placementAt', () => {
  it('reads the household wall clock, not UTC', () => {
    // 07:10 Monday in Chicago is 13:10 UTC.
    expect(placementAt([morning], chicago('2026-11-02', '07:10'), CHICAGO)).toEqual({ index: 0, dashboardId: MORNING });
    expect(placementAt([morning], chicago('2026-11-02', '07:10'), 'UTC')).toEqual({ index: -1, dashboardId: null });
    // The weekday too: Sunday 23:30 in Chicago is already Monday in UTC.
    expect(placementAt([night], chicago('2026-11-01', '23:30'), CHICAGO).dashboardId).toBeNull();
    expect(placementAt([night], chicago('2026-11-07', '23:30'), CHICAGO).dashboardId).toBe(NIGHT);
  });

  it('overlapping placements: the first in the list wins', () => {
    const early: Placement = { days: WEEKDAYS, from: '06:30', to: '08:00', dashboardId: NIGHT };
    const at = chicago('2026-11-02', '07:10');
    expect(placementAt([morning, early], at, CHICAGO)).toEqual({ index: 0, dashboardId: MORNING });
    expect(placementAt([early, morning], at, CHICAGO)).toEqual({ index: 0, dashboardId: NIGHT });
  });

  it('skips a placement whose dashboard is gone', () => {
    const early: Placement = { days: WEEKDAYS, from: '06:30', to: '08:00', dashboardId: NIGHT };
    const at = chicago('2026-11-02', '07:10');
    expect(placementAt([morning, early], at, CHICAGO, (id) => id !== MORNING)).toEqual({ index: 1, dashboardId: NIGHT });
    expect(placementAt([morning], at, CHICAGO, () => false)).toEqual({ index: -1, dashboardId: null });
  });
});

describe('the dashboard a screen shows comes from the timeline it picked', () => {
  const main = timeline('main', 0, { placements: [morning, night] });
  const quiet = timeline('quiet', 1, { dashboardId: HALL });
  const all = [quiet, main];
  /** What a screen on `timelineId` shows at `at`. */
  const shows = (timelineId: string | null, at: Date) => timelineDashboardAt(timelineFor(all, timelineId)!, at, CHICAGO);

  it('a placement on weekdays shows on each of them, and the rest of the day otherwise', () => {
    for (const date of ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']) {
      expect(shows('main', chicago(date, '07:10'))).toBe(MORNING);
      expect(shows('main', chicago(date, '12:00'))).toBe(KITCHEN);
    }
    // Saturday morning: not a weekday.
    expect(shows('main', chicago('2026-11-07', '07:10'))).toBe(KITCHEN);
  });

  it('across midnight: Friday night runs into Saturday morning, then the rest of the day', () => {
    expect(shows('main', chicago('2026-11-06', '23:30'))).toBe(NIGHT);
    expect(shows('main', chicago('2026-11-07', '05:59'))).toBe(NIGHT);
    expect(shows('main', chicago('2026-11-07', '06:00'))).toBe(KITCHEN);
  });

  it('two screens on one timeline change together', () => {
    const kitchen = { timelineId: 'main' };
    const hall = { timelineId: null }; // never picked one: the first
    const at = chicago('2026-11-02', '07:10');
    expect(shows(kitchen.timelineId, at)).toBe(shows(hall.timelineId, at));
    // One change to the timeline reaches both.
    main.dashboardId = HALL;
    const noon = chicago('2026-11-02', '12:00');
    expect(shows(kitchen.timelineId, noon)).toBe(HALL);
    expect(shows(hall.timelineId, noon)).toBe(HALL);
    main.dashboardId = KITCHEN;
  });

  it('screens on different timelines show different dashboards at the same moment', () => {
    const at = chicago('2026-11-02', '07:10');
    expect(shows('main', at)).toBe(MORNING);
    expect(shows('quiet', at)).toBe(HALL);
  });

  it('the rest of the day is the household default when unset or gone', () => {
    const plain = timeline('plain', 0, { dashboardId: null });
    expect(timelineDashboardAt(plain, chicago('2026-11-02', '12:00'), CHICAGO)).toBeNull();
    expect(timelineDashboardAt(main, chicago('2026-11-02', '12:00'), CHICAGO, (id) => id !== KITCHEN)).toBeNull();
  });
});

describe('which timeline a screen follows', () => {
  const a = timeline('a', 3);
  const b = timeline('b', 0);
  const c = timeline('c', 1);

  it('the first is the lowest position', () => {
    expect(firstTimeline([a, b, c])).toBe(b);
    expect(firstTimeline([])).toBeNull();
  });

  it('its own when it picked one, the first when it picked none', () => {
    expect(timelineFor([a, b, c], 'c')).toBe(c);
    expect(timelineFor([a, b, c], null)).toBe(b);
  });

  it('deleting the timeline a screen is on moves it to the first', () => {
    const screen = { timelineId: 'c' };
    const left = [a, b];
    expect(timelineFor(left, screen.timelineId)).toBe(b);
    // The first itself deleted: the next lowest is first now.
    expect(timelineFor([a, c], 'b')).toBe(c);
  });
});

describe('duplicate', () => {
  it('matches its source, and a later edit to either leaves the other alone', () => {
    const source = timeline('src', 0, {
      placements: [morning, night],
      idleBackground: { day: 'photos', night: 'sky', switch: { by: 'clock', from: '21:00', to: '06:30' } },
    });
    const copy = duplicateOf(source, 'src copy');
    expect(copy).toEqual({ name: 'src copy', dashboardId: source.dashboardId, placements: source.placements, idleBackground: source.idleBackground });

    copy.placements![0]!.days.push(6);
    copy.placements!.push({ ...morning, dashboardId: HALL });
    (copy.idleBackground as { night: string }).night = 'off';
    expect(source.placements).toEqual([morning, night]);
    expect(morning.days).toEqual(WEEKDAYS);
    expect(source.idleBackground).toMatchObject({ night: 'sky' });

    source.placements.pop();
    expect(copy.placements).toHaveLength(3);
  });

  it('is named after its source', () => {
    expect(copyName('Main', ['Main'])).toBe('Main copy');
    expect(copyName('Main', ['Main', 'Main copy', 'Main copy 2'])).toBe('Main copy 3');
  });
});

describe('timelineShows', () => {
  it('for the rest of the day, or in a placement', () => {
    const main = timeline('main', 0, { dashboardId: null, placements: [morning] });
    expect(timelineShows(main, { id: KITCHEN, isDefault: true })).toBe(true);
    expect(timelineShows(main, { id: MORNING, isDefault: false })).toBe(true);
    expect(timelineShows(main, { id: HALL, isDefault: false })).toBe(false);
  });
});

describe('stored value', () => {
  it('reads what it can and drops the rest', () => {
    expect(parsePlacements([
      morning,
      { ...morning, from: '7:00' },
      { ...morning, to: '24:00' },
      { ...morning, days: [] },
      { ...morning, days: [9] },
      { ...morning, dashboardId: '' },
      'nonsense',
    ])).toEqual([morning]);
    expect(parsePlacements('not a list')).toEqual([]);
    expect(parsePlacements(null)).toEqual([]);
    const many = Array.from({ length: MAX_PLACEMENTS + 3 }, () => morning);
    expect(parsePlacements(many)).toHaveLength(MAX_PLACEMENTS);
  });

  it('a change is checked before it is kept', () => {
    expect(timelinePatchSchema.safeParse({ placements: [morning] }).success).toBe(true);
    expect(timelinePatchSchema.safeParse({ placements: [{ ...morning, days: [] }] }).success).toBe(false);
    expect(timelinePatchSchema.safeParse({ name: '  ' }).success).toBe(false);
    expect(timelinePatchSchema.safeParse({ dashboardId: null }).success).toBe(true);
    expect(timelinePatchSchema.safeParse({ somethingElse: 1 }).success).toBe(false);
  });
});

describe('daysInWords', () => {
  it('names the common sets', () => {
    expect(daysInWords([1, 2, 3, 4, 5])).toBe('Weekdays');
    expect(daysInWords([6, 0])).toBe('Weekend');
    expect(daysInWords([0, 1, 2, 3, 4, 5, 6])).toBe('Every day');
    expect(daysInWords([4, 2])).toBe('Tue, Thu');
  });
});
