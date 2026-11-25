/**
 * The Through the day slider's stops (#1294): night's start and end by the
 * dashboard's rule, each switch's start and end on today's weekday, and now;
 * and what the screen shows at each.
 */
import * as SunCalc from 'suncalc';
import { dayStops, nearestStop, nightSpans, sceneAt, switchSpans, type Stop } from '../dayWaypoints';
import type { ScreenSwitch } from '../screenSwitches';

const KITCHEN = 'kitchen';
const SCHOOL = 'school';
const AMBIENT = 'ambient';
/** A morning run due at the stop at 7:45 and an afternoon one at 3:30, on weekdays. */
const ROUTES = [
  { id: 'am', scheduledTime: '07:45', activeDays: [1, 2, 3, 4, 5] },
  { id: 'pm', scheduledTime: '15:30', activeDays: [1, 2, 3, 4, 5] },
];
/** A bus switch on every route, and Ambient from 1:45 to 2:45 every day. */
const SWITCHES: ScreenSwitch[] = [
  { when: 'bus', dashboardId: SCHOOL },
  { when: 'times', days: [0, 1, 2, 3, 4, 5, 6], from: '01:45', to: '02:45', dashboardId: AMBIENT },
];
const MONDAY = 1;
const SUNDAY = 0;
const at = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const words = (stops: Stop[]) => stops.map((s) => `${s.minute} ${s.marks.map((m) => `${m.kind}${m.switchIndex ?? ''}`).join('+')}`);

describe('switchSpans', () => {
  it('puts a bus switch around each route that runs today, and set times on their days', () => {
    expect(switchSpans(SWITCHES, MONDAY, ROUTES)).toEqual([
      { index: 0, from: at('07:15'), to: at('08:00'), starts: true, ends: true },
      { index: 0, from: at('15:00'), to: at('15:45'), starts: true, ends: true },
      { index: 1, from: at('01:45'), to: at('02:45'), starts: true, ends: true },
    ]);
    // No bus on Sunday.
    expect(switchSpans(SWITCHES, SUNDAY, ROUTES).map((s) => s.index)).toEqual([1]);
  });

  it('two routes whose windows overlap are one stretch, as nothing changes between them', () => {
    const close = [...ROUTES, { id: 'late', scheduledTime: '08:00', activeDays: [1, 2, 3, 4, 5] }];
    expect(switchSpans([{ when: 'bus', dashboardId: SCHOOL }], MONDAY, close)).toEqual([
      { index: 0, from: at('07:15'), to: at('08:15'), starts: true, ends: true },
      { index: 0, from: at('15:00'), to: at('15:45'), starts: true, ends: true },
    ]);
  });

  it('a bus switch keeps its own minutes and routes (#1291)', () => {
    expect(switchSpans([{ when: 'bus', dashboardId: SCHOOL, routeIds: ['pm'], before: 10, after: 5 }], MONDAY, ROUTES))
      .toEqual([{ index: 0, from: at('15:20'), to: at('15:35'), starts: true, ends: true }]);
  });

  it('one past midnight is the morning part from the day before and the evening part from today', () => {
    const late: ScreenSwitch = { when: 'times', days: [SUNDAY], from: '22:00', to: '06:00', dashboardId: AMBIENT };
    expect(switchSpans([late], SUNDAY)).toEqual([{ index: 0, from: at('22:00'), to: 24 * 60, starts: true, ends: false }]);
    expect(switchSpans([late], MONDAY)).toEqual([{ index: 0, from: 0, to: at('06:00'), starts: false, ends: true }]);
  });
});

describe('nightSpans', () => {
  it('by the clock: the morning end of last night and the start of tonight', () => {
    const day = new Date(2026, 10, 23, 12);
    expect(nightSpans(day, { by: 'clock', from: '21:00', to: '06:30' }, 45, -100)).toEqual([
      { from: 0, to: at('06:30'), starts: false, ends: true },
      { from: at('21:00'), to: 24 * 60, starts: true, ends: false },
    ]);
  });

  it('by the sun: dusk and dawn from the location, moved by the offsets', () => {
    const day = new Date(2026, 10, 23, 12);
    // A place whose sun keeps the zone's clock, as the location guess has it,
    // so the day's dawn and dusk fall in its morning and evening.
    const [lat, lon] = [45, -day.getTimezoneOffset() / 4];
    const wall = (d: Date) => d.getHours() * 60 + d.getMinutes();
    const sunrise = SunCalc.getTimes(day, lat, lon).sunrise!;
    const sunset = SunCalc.getTimes(day, lat, lon).sunset!;
    const spans = nightSpans(day, { by: 'sun', duskOffset: 30, dawnOffset: -30 }, lat, lon);
    expect(spans.filter((s) => s.ends).map((s) => s.to)).toEqual([wall(new Date(sunrise.getTime() - 30 * 60_000))]);
    expect(spans.filter((s) => s.starts).map((s) => s.from)).toEqual([wall(new Date(sunset.getTime() + 30 * 60_000))]);
  });
});

describe('dayStops', () => {
  const nights = nightSpans(new Date(2026, 10, 23, 12), { by: 'clock', from: '21:00', to: '06:30' }, 45, -100);
  const spans = switchSpans(SWITCHES, MONDAY, ROUTES);

  it('every change on a Monday, and now, in time order', () => {
    expect(words(dayStops({ now: at('10:00'), nights, switches: spans }))).toEqual([
      `${at('01:45')} switch-start1`,
      `${at('02:45')} switch-end1`,
      `${at('06:30')} night-end`,
      `${at('07:15')} switch-start0`,
      `${at('08:00')} switch-end0`,
      `${at('10:00')} now`,
      `${at('15:00')} switch-start0`,
      `${at('15:45')} switch-end0`,
      `${at('21:00')} night-start`,
    ]);
  });

  it('changes at one minute are one stop', () => {
    const stops = dayStops({ now: at('21:00'), nights, switches: [] });
    expect(words(stops).pop()).toBe(`${at('21:00')} now+night-start`);
  });

  it('a dashboard on its own has only night\'s start and end', () => {
    expect(words(dayStops({ now: at('10:00'), nights, switches: [] }))).toEqual([
      `${at('06:30')} night-end`, `${at('10:00')} now`, `${at('21:00')} night-start`,
    ]);
  });

  it('a drag lets go on the nearest stop', () => {
    const stops = dayStops({ now: at('10:00'), nights, switches: spans });
    expect(stops[nearestStop(stops, at('07:20'))]!.minute).toBe(at('07:15'));
    expect(stops[nearestStop(stops, at('23:59'))]!.minute).toBe(at('21:00'));
    expect(stops[nearestStop(stops, 0)]!.minute).toBe(at('01:45'));
  });
});

describe('sceneAt', () => {
  const nights = nightSpans(new Date(2026, 10, 23, 12), { by: 'clock', from: '21:00', to: '06:30' }, 45, -100);
  const spans = switchSpans(SWITCHES, MONDAY, ROUTES);
  const scene = (hhmm: string, exists?: (id: string) => boolean) =>
    sceneAt(at(hhmm), { spans, switches: SWITCHES, nights, shownId: KITCHEN, exists });

  it('the switch\'s dashboard during a switch, the night look at night, its own dashboard otherwise', () => {
    expect(scene('07:15')).toEqual({ dashboardId: SCHOOL, state: 'active', night: false, switchIndex: 0 });
    // At its end it is back.
    expect(scene('08:00')).toEqual({ dashboardId: KITCHEN, state: 'active', night: false, switchIndex: -1 });
    expect(scene('10:00')).toEqual({ dashboardId: KITCHEN, state: 'active', night: false, switchIndex: -1 });
    expect(scene('21:00')).toEqual({ dashboardId: KITCHEN, state: 'night', night: true, switchIndex: -1 });
    // A switch at night shows its dashboard in use, at night; after it, idle at night again.
    expect(scene('01:45')).toEqual({ dashboardId: AMBIENT, state: 'active', night: true, switchIndex: 1 });
    expect(scene('02:45')).toEqual({ dashboardId: KITCHEN, state: 'night', night: true, switchIndex: -1 });
  });

  it('night is the screen\'s own, whichever dashboard is being edited (#1348)', () => {
    // Editing Ambient from Kitchen's editor: the line drew no night, as it
    // was not Ambient's; the screen idles at night all the same.
    expect(sceneAt(at('21:00'), { spans, switches: SWITCHES, nights, shownId: KITCHEN }))
      .toEqual({ dashboardId: KITCHEN, state: 'night', night: true, switchIndex: -1 });
  });

  it('a switch to a dashboard that is gone does not count', () => {
    expect(scene('07:15', (id) => id !== SCHOOL)).toEqual({ dashboardId: KITCHEN, state: 'active', night: false, switchIndex: -1 });
  });

  it('the first switch in order wins an overlap', () => {
    const both: ScreenSwitch[] = [
      { when: 'times', days: [MONDAY], from: '07:00', to: '09:00', dashboardId: AMBIENT },
      { when: 'bus', dashboardId: SCHOOL },
    ];
    const s = sceneAt(at('07:30'), { spans: switchSpans(both, MONDAY, ROUTES), switches: both, nights, shownId: KITCHEN });
    expect(s).toEqual({ dashboardId: AMBIENT, state: 'active', night: false, switchIndex: 0 });
  });
});
