import { nightsTouching, type IdleSwitch } from './idleBackground';
import { busWindowOf, routesOf, type BusTime, type ScreenSwitch } from './screenSwitches';

/**
 * The Through the day slider (#1294): one day as a line, with a stop wherever
 * what the screen shows changes, and what it shows at each.
 *
 *  - Night starts and ends, by the dashboard's own rule (dusk and dawn moved
 *    by their offsets, or set times).
 *  - Each switch starts and ends, on today's weekday: a bus switch around each
 *    of its routes that runs today, a set-times one on its days, the morning
 *    part of one that ran past midnight included.
 *  - Now, so the slider can come back to it.
 *
 * Minutes run 0 to 1440 by the wall clock, so 6:30 sits where the clock says
 * 6:30 even on a day the clocks change. The slider only shows: nothing is set
 * on it (#1281 took away the line that hid settings behind taps).
 */

export const DAY_MINUTES = 24 * 60;

/** A stretch of the day, in minutes, `to` not included. */
export type Span = { from: number; to: number };
/** A switch's stretch: which switch, and whether it starts and ends on this day. */
export type SwitchSpan = Span & { index: number; starts: boolean; ends: boolean };
/** A night's stretch: whether it starts and ends on this day. */
export type NightSpan = Span & { starts: boolean; ends: boolean };

export type WaypointKind = 'now' | 'night-start' | 'night-end' | 'switch-start' | 'switch-end';
export type Waypoint = { kind: WaypointKind; minute: number; switchIndex?: number };
/** A stop on the slider: one minute, and every change that happens then. */
export type Stop = { minute: number; marks: Waypoint[] };

/**
 * What the screen shows at a minute: a dashboard, in use or idle at night,
 * whether it is night, and the switch in force (-1 for none). Night is the
 * screen's own (#1345), whichever dashboard is up or being edited (#1348); a
 * switch that starts shows its dashboard in use, at night too.
 */
export type Scene = { dashboardId: string; state: 'active' | 'night'; night: boolean; switchIndex: number };

const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const wall = (d: Date) => d.getHours() * 60 + d.getMinutes();

/** The nights that touch the local day of `day`, on its wall clock. */
export function nightSpans(day: Date, rule: IdleSwitch, lat: number, lon: number): NightSpan[] {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  return nightsTouching(day, rule, lat, lon)
    .map((n) => {
      const starts = n.start > start;
      const ends = n.end < end;
      return { from: starts ? wall(n.start) : 0, to: ends ? wall(n.end) : DAY_MINUTES, starts, ends };
    })
    .filter((n) => n.to > n.from)
    .sort((a, b) => a.from - b.from);
}

/**
 * Where each switch falls on `weekday` (0 = Sunday), in order: a set-times
 * switch on its days, and the morning part of one that ran past midnight from
 * the day before; a bus switch from its minutes before each route's time to
 * its minutes after, on the route's days.
 */
export function switchSpans(switches: readonly ScreenSwitch[], weekday: number, routes: readonly BusTime[] = []): SwitchSpan[] {
  const yesterday = (weekday + 6) % 7;
  const spans: SwitchSpan[] = [];
  switches.forEach((sw, index) => {
    if (sw.when === 'bus') {
      const { before, after } = busWindowOf(sw);
      const windows: SwitchSpan[] = [];
      for (const r of routesOf(sw, routes)) {
        const time = r.scheduledTime?.slice(0, 5) ?? '';
        if (!r.activeDays?.includes(weekday) || !HHMM.test(time)) continue;
        const due = minutesOf(time);
        const from = Math.max(0, due - before);
        const to = Math.min(DAY_MINUTES, due + after);
        if (to > from) windows.push({ index, from, to, starts: due - before >= 0, ends: due + after < DAY_MINUTES });
      }
      // Two routes whose windows overlap or touch keep the screen switched
      // from the first start to the last end: nothing changes between.
      windows.sort((a, b) => a.from - b.from);
      for (const w of windows) {
        const last = spans[spans.length - 1];
        if (last && last.index === index && w.from <= last.to) {
          if (w.to > last.to) { last.to = w.to; last.ends = w.ends; }
        } else spans.push(w);
      }
      return;
    }
    const from = minutesOf(sw.from);
    const to = minutesOf(sw.to);
    if (from === to) {
      // All day: nothing changes within it.
      if (sw.days.includes(weekday)) spans.push({ index, from: 0, to: DAY_MINUTES, starts: false, ends: false });
    } else if (from < to) {
      if (sw.days.includes(weekday)) spans.push({ index, from, to, starts: true, ends: true });
    } else {
      if (sw.days.includes(yesterday)) spans.push({ index, from: 0, to, starts: false, ends: true });
      if (sw.days.includes(weekday)) spans.push({ index, from, to: DAY_MINUTES, starts: true, ends: false });
    }
  });
  return spans;
}

/** The stops on the slider, in time order, one per minute that has any. */
export function dayStops({ now, nights, switches }: { now: number; nights: readonly NightSpan[]; switches: readonly SwitchSpan[] }): Stop[] {
  const marks: Waypoint[] = [{ kind: 'now', minute: now }];
  for (const n of nights) {
    if (n.starts) marks.push({ kind: 'night-start', minute: n.from });
    if (n.ends) marks.push({ kind: 'night-end', minute: n.to });
  }
  for (const s of switches) {
    if (s.starts) marks.push({ kind: 'switch-start', minute: s.from, switchIndex: s.index });
    if (s.ends) marks.push({ kind: 'switch-end', minute: s.to, switchIndex: s.index });
  }
  const byMinute = new Map<number, Waypoint[]>();
  for (const m of marks) {
    const at = byMinute.get(m.minute) ?? [];
    // One switch's two routes can end at the same minute: say it once.
    if (!at.some((x) => x.kind === m.kind && x.switchIndex === m.switchIndex)) at.push(m);
    byMinute.set(m.minute, at);
  }
  return [...byMinute.entries()].sort(([a], [b]) => a - b).map(([minute, at]) => ({ minute, marks: at }));
}

/**
 * What the screen shows at `minute`: the first switch in force, in order,
 * whose dashboard still exists; otherwise its own dashboard. At a switch's
 * end it is already back. Outside a switch the screen shows its night look
 * during its night, whichever dashboard is being edited.
 */
export function sceneAt(minute: number, { spans, switches, nights, shownId, exists = () => true }: {
  /** Where the switches fall today, from `switchSpans`. */
  spans: readonly SwitchSpan[];
  /** The screen's switches, in order. */
  switches: readonly ScreenSwitch[];
  nights: readonly Span[];
  /** The dashboard the screen shows outside its switches. */
  shownId: string;
  exists?: (dashboardId: string) => boolean;
}): Scene {
  const inForce = spans
    .filter((s) => s.from <= minute && minute < s.to && !!switches[s.index] && exists(switches[s.index]!.dashboardId))
    .sort((a, b) => a.index - b.index)[0];
  const dashboardId = inForce ? switches[inForce.index]!.dashboardId : shownId;
  const night = nights.some((n) => n.from <= minute && minute < n.to);
  return { dashboardId, state: night && !inForce ? 'night' : 'active', night, switchIndex: inForce?.index ?? -1 };
}

/** The stop nearest `minute`, as a drag lets go of the line. */
export function nearestStop(stops: readonly Stop[], minute: number): number {
  let best = 0;
  stops.forEach((s, i) => { if (Math.abs(s.minute - minute) < Math.abs(stops[best]!.minute - minute)) best = i; });
  return best;
}
