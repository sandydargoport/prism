import { z } from 'zod';
import { todayKey, wallTimeAt, wallTimeToday, weekdayOfKey } from '@/lib/utils/zonedDate';

/**
 * A screen's dashboard and its switches (#1282).
 *
 * A named screen shows one dashboard (null is the household default), and can
 * switch to another for a while:
 *
 *  - at bus time: from some minutes before a bus route's time at the home
 *    stop to some after, 30 and 15 unless the switch says otherwise, on the
 *    route's days, so a route due at 7:45 on weekdays switches the screen from
 *    7:15 to 8:00. It follows every route, or the ones it names (#1291). A
 *    change to a route's time moves the switch with it.
 *  - at set times: on chosen days, from one time to another, on the
 *    household's wall clock. One whose end is not after its start runs past
 *    midnight and belongs to the day it starts on; one that starts and ends at
 *    the same time lasts the whole day.
 *
 * The first switch that matches wins. A device nobody named shows the default
 * dashboard and has no switches.
 *
 * Plain functions with no browser in them: the home page picks the dashboard
 * on the server before the screen has loaded anything.
 */

/** The React transition type a scheduled change over runs under (see CssGridDisplay). */
export const SCHEDULE_TRANSITION = 'screen-schedule';

/** Plenty for a day, and few enough to read as rows. */
export const MAX_SWITCHES = 12;

/** The bus window, unless a switch says otherwise: this long before a route's time at the stop. */
export const BUS_BEFORE_MINUTES = 30;
/** And this long after. */
export const BUS_AFTER_MINUTES = 15;
/** The most a bus window reaches either side of a route's time. */
export const MAX_BUS_MINUTES = 120;
/** The minutes a bus window offers either side, as a list to pick from. */
export const BUS_MINUTE_CHOICES = [0, 5, 10, 15, 20, 30, 45, 60, 90, 120];

export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAYS = [1, 2, 3, 4, 5];
export const WEEKEND = [0, 6];

export type TimesSwitch = {
  when: 'times';
  /** 0 = Sunday ... 6 = Saturday. */
  days: number[];
  /** `HH:mm`, inclusive. */
  from: string;
  /** `HH:mm`, exclusive. */
  to: string;
  dashboardId: string;
};

export type BusSwitch = {
  when: 'bus';
  dashboardId: string;
  /** The routes it follows; absent follows every route, ones added later included. */
  routeIds?: string[];
  /** Minutes before a route's time at the stop; absent is BUS_BEFORE_MINUTES. */
  before?: number;
  /** Minutes after; absent is BUS_AFTER_MINUTES. */
  after?: number;
};

export type ScreenSwitch = TimesSwitch | BusSwitch;

/** What a screen shows: its dashboard (null is the default) and its switches. */
export type ScreenPlan = { dashboardId: string | null; switches: ScreenSwitch[] };

/** A bus route's time at the home stop and its days, all a bus switch needs, and its id to pick it by. */
export type BusTime = { id?: string; scheduledTime: string; activeDays: number[] };

/** How far either side of a route's time a bus window reaches, in minutes. */
export type BusWindow = { before: number; after: number };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function minutesOf(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
}

const isMinutes = (m: unknown): m is number => Number.isInteger(m) && (m as number) >= 0 && (m as number) <= MAX_BUS_MINUTES;

function cleanSwitch(raw: unknown): ScreenSwitch | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.dashboardId !== 'string' || !r.dashboardId) return null;
  if (r.when === 'bus') {
    const bus: BusSwitch = { when: 'bus', dashboardId: r.dashboardId };
    const ids = Array.isArray(r.routeIds) ? [...new Set(r.routeIds.filter((x): x is string => typeof x === 'string' && x.length > 0))] : [];
    // None named follows every route.
    if (ids.length > 0) bus.routeIds = ids;
    if (isMinutes(r.before)) bus.before = r.before;
    if (isMinutes(r.after)) bus.after = r.after;
    return bus;
  }
  if (r.when !== 'times') return null;
  if (typeof r.from !== 'string' || !HHMM.test(r.from)) return null;
  if (typeof r.to !== 'string' || !HHMM.test(r.to)) return null;
  if (!Array.isArray(r.days)) return null;
  const days = [...new Set(r.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  if (days.length === 0) return null;
  return { when: 'times', days, from: r.from, to: r.to, dashboardId: r.dashboardId };
}

/** The switches in a stored value, in order. Anything unreadable is left out rather than failing the lot. */
export function parseSwitches(raw: unknown): ScreenSwitch[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(cleanSwitch).filter((s): s is ScreenSwitch => s !== null).slice(0, MAX_SWITCHES);
}

/** A screen's switches, as a request may send them. */
export const switchesSchema = z.array(z.discriminatedUnion('when', [
  z.object({
    when: z.literal('bus'),
    dashboardId: z.guid(),
    routeIds: z.array(z.guid()).min(1).max(50).optional(),
    before: z.number().int().min(0).max(MAX_BUS_MINUTES).optional(),
    after: z.number().int().min(0).max(MAX_BUS_MINUTES).optional(),
  }).strict(),
  z.object({
    when: z.literal('times'),
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    from: z.string().regex(HHMM),
    to: z.string().regex(HHMM),
    dashboardId: z.guid(),
  }).strict(),
])).max(MAX_SWITCHES);

/** Whether a set-times switch covers a moment `minute` minutes into `weekday` on the wall clock. */
export function timesCover(s: Pick<TimesSwitch, 'days' | 'from' | 'to'>, weekday: number, minute: number): boolean {
  const from = minutesOf(s.from);
  const to = minutesOf(s.to);
  if (from === to) return s.days.includes(weekday);
  if (from < to) return s.days.includes(weekday) && minute >= from && minute < to;
  // Past midnight: the evening part on the day itself, the morning part on the next.
  const yesterday = (weekday + 6) % 7;
  return (s.days.includes(weekday) && minute >= from) || (s.days.includes(yesterday) && minute < to);
}

/** A bus switch's window, its own minutes or the usual 30 before and 15 after. */
export function busWindowOf(s: Pick<BusSwitch, 'before' | 'after'>): BusWindow {
  return { before: s.before ?? BUS_BEFORE_MINUTES, after: s.after ?? BUS_AFTER_MINUTES };
}

/** The routes a bus switch follows: the ones it names, or every route when it names none. */
export function routesOf<T extends BusTime>(s: Pick<BusSwitch, 'routeIds'>, routes: readonly T[]): T[] {
  return s.routeIds ? routes.filter((r) => r.id !== undefined && s.routeIds!.includes(r.id)) : [...routes];
}

/**
 * Whether it is bus time: some route runs today, on the household's calendar,
 * and `now` is from `before` minutes before its time at the stop to `after`
 * after (30 and 15 unless given), both ends included.
 */
export function busTimeAt(
  routes: readonly BusTime[],
  now: Date | number,
  timeZone: string,
  { before, after }: BusWindow = { before: BUS_BEFORE_MINUTES, after: BUS_AFTER_MINUTES },
): boolean {
  const at = new Date(now).getTime();
  let weekday: number;
  try {
    weekday = weekdayOfKey(todayKey(timeZone, at));
  } catch {
    return false;
  }
  return routes.some((r) => {
    if (!r.activeDays?.includes(weekday) || !HHMM.test(r.scheduledTime?.slice(0, 5) ?? '')) return false;
    let due: number;
    try {
      due = wallTimeToday(r.scheduledTime.slice(0, 5), timeZone, at).getTime();
    } catch {
      return false;
    }
    return at >= due - before * 60_000 && at <= due + after * 60_000;
  });
}

export type SwitchedTo = {
  /** Index of the switch in force, or -1 when none is. */
  index: number;
  /** The dashboard it shows, or null outside every switch. */
  dashboardId: string | null;
};

/**
 * Which switch is in force at `now`: the first, in order, that matches and
 * whose dashboard still exists.
 */
export function switchAt(
  switches: readonly ScreenSwitch[],
  now: Date | number,
  timeZone: string,
  routes: readonly BusTime[] = [],
  exists: (dashboardId: string) => boolean = () => true,
): SwitchedTo {
  const weekday = weekdayOfKey(todayKey(timeZone, now));
  const minute = minutesOf(wallTimeAt(timeZone, now));
  const index = switches.findIndex((s) => exists(s.dashboardId)
    && (s.when === 'bus' ? busTimeAt(routesOf(s, routes), now, timeZone, busWindowOf(s)) : timesCover(s, weekday, minute)));
  return index === -1 ? { index: -1, dashboardId: null } : { index, dashboardId: switches[index]!.dashboardId };
}

/**
 * The dashboard a screen shows at `now`: a switch's while one is in force,
 * otherwise its own (null is the household default, as is one that no
 * longer exists).
 */
export function screenDashboardAt(
  plan: ScreenPlan,
  now: Date | number,
  timeZone: string,
  routes: readonly BusTime[] = [],
  exists: (dashboardId: string) => boolean = () => true,
): string | null {
  const switched = switchAt(plan.switches, now, timeZone, routes, exists).dashboardId;
  if (switched) return switched;
  return plan.dashboardId && exists(plan.dashboardId) ? plan.dashboardId : null;
}

/** Whether a screen ever shows `dashboard`: as its own, or in a switch. */
export function screenShows(plan: ScreenPlan, dashboard: { id: string; isDefault: boolean }): boolean {
  if (plan.dashboardId === dashboard.id || (plan.dashboardId === null && dashboard.isDefault)) return true;
  return plan.switches.some((s) => s.dashboardId === dashboard.id);
}

/** Whether two plans say the same, so an unchanged one is not sent. */
export function samePlan(a: ScreenPlan, b: ScreenPlan): boolean {
  return (a.dashboardId ?? null) === (b.dashboardId ?? null) && JSON.stringify(a.switches) === JSON.stringify(b.switches);
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** Monday first, as a week is read. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/**
 * A set of days, short and Monday first: "Every day", "Mon–Fri", "Sat, Sun",
 * "Mon, Wed, Fri". Three or more days in a row are a range.
 */
export function daysShort(days: number[]): string {
  const on = WEEK_ORDER.filter((d) => days.includes(d));
  if (on.length === 7) return 'Every day';
  const runs: number[][] = [];
  for (const d of on) {
    const run = runs[runs.length - 1];
    if (run && WEEK_ORDER.indexOf(d) === WEEK_ORDER.indexOf(run[run.length - 1]!) + 1) run.push(d);
    else runs.push([d]);
  }
  return runs
    .map((r) => (r.length >= 3 ? `${DAY_NAMES[r[0]!]}–${DAY_NAMES[r[r.length - 1]!]}` : r.map((d) => DAY_NAMES[d]).join(', ')))
    .join(', ');
}

/**
 * A switch in words, for a summary line: "School run at bus time",
 * "Ambient Mon–Fri 1:45 am to 2:45 am". `clock` writes a time the way the
 * household reads one.
 */
export function switchInWords(s: ScreenSwitch, name: string, clock: (hhmm: string) => string): string {
  if (s.when === 'bus') return `${name} at bus time`;
  return `${name} ${daysShort(s.days)} ${clock(s.from)} to ${clock(s.to)}`;
}
