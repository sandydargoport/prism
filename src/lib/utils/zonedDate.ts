/**
 * Calendar-day arithmetic in an explicit IANA time zone. Usable on the server
 * and the client (no DOM, no DB).
 *
 * Every helper that depends on "where" takes the zone as an argument and never
 * reads the process zone, so the same call gives the same answer on a UTC
 * container, a Home Assistant host and a browser. Server code gets the zone
 * from getHouseholdTimezone(). An invalid zone throws a RangeError rather than
 * quietly falling back, since a wrong day is harder to notice than an error.
 *
 * Dates without a time travel as "date keys": `YYYY-MM-DD` strings, compared
 * and sorted as strings. Where a Date is needed for a date-only value, it is
 * UTC midnight of that date ("floating"), read back with the UTC getters.
 */

import { getWallClockFormatter } from './timeFormat';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const WALL_TIME_RE = /^(\d{1,2}):(\d{2})$/;

type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function wallClockAt(instantMs: number, timeZone: string): WallClock {
  const parts = getWallClockFormatter(timeZone).formatToParts(new Date(instantMs));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    // Some runtimes report midnight as 24 even with hourCycle h23.
    hour: value('hour') % 24,
    minute: value('minute'),
    second: value('second'),
  };
}

/** The zone's UTC offset at an instant, in ms (Chicago in winter: -6h). */
function offsetAt(instantMs: number, timeZone: string): number {
  const w = wallClockAt(instantMs, timeZone);
  const wallAsUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return wallAsUtc - Math.floor(instantMs / 1000) * 1000;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function keyFromParts(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
}

function splitDateKey(dateKey: string): [number, number, number] {
  const key = parseDateOnly(dateKey);
  if (!key) throw new RangeError(`Invalid date key: ${dateKey}`);
  const [, y, m, d] = DATE_KEY_RE.exec(key)!;
  return [Number(y), Number(m), Number(d)];
}

/**
 * Accept a date-only value and return its date key, or null if it is not a
 * real calendar date. Takes `YYYY-MM-DD`, or the date part of an ISO string
 * (`2026-03-08T00:00:00.000Z` gives `2026-03-08`: the date as written, never
 * shifted through a zone). Rejects impossible dates such as 2026-02-30.
 */
export function parseDateOnly(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value.trim());
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return keyFromParts(year, month, day);
}

/** The floating Date for a date key: UTC midnight of that calendar date. */
export function dateOnlyToFloatingUtc(dateKey: string): Date {
  const [y, m, d] = splitDateKey(dateKey);
  return new Date(Date.UTC(y, m - 1, d));
}

/** The date key of a floating Date, read with the UTC getters. */
export function floatingUtcToDateKey(date: Date): string {
  return keyFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** The date key `days` after (or before, if negative) `dateKey`. */
export function addDaysToKey(dateKey: string, days: number): string {
  const [y, m, d] = splitDateKey(dateKey);
  return floatingUtcToDateKey(new Date(Date.UTC(y, m - 1, d + days)));
}

/**
 * Whole calendar days from `fromKey` to `toKey`: 1 for tomorrow, 0 for the
 * same day, negative for the past. Exact across DST changes, since date keys
 * have no time of day to be 23 or 25 hours apart.
 */
export function calendarDaysBetween(fromKey: string, toKey: string): number {
  const from = dateOnlyToFloatingUtc(fromKey).getTime();
  const to = dateOnlyToFloatingUtc(toKey).getTime();
  return Math.round((to - from) / MS_PER_DAY);
}

/** Day of the week of a date key: 0 = Sunday ... 6 = Saturday. */
export function weekdayOfKey(dateKey: string): number {
  return dateOnlyToFloatingUtc(dateKey).getUTCDay();
}

/** The date key of the first day of the week containing `dateKey`. */
export function startOfWeekKey(dateKey: string, weekStartsOn: 0 | 1): string {
  return addDaysToKey(dateKey, -((weekdayOfKey(dateKey) - weekStartsOn + 7) % 7));
}

/** The date key of the first day of the month containing `dateKey`. */
export function startOfMonthKey(dateKey: string): string {
  const [y, m] = splitDateKey(dateKey);
  return keyFromParts(y, m, 1);
}

/** The date key of 1 January of the year containing `dateKey`. */
export function startOfYearKey(dateKey: string): string {
  const [y] = splitDateKey(dateKey);
  return keyFromParts(y, 1, 1);
}

/** The calendar date in `timeZone` at `now`, as a date key. */
export function todayKey(timeZone: string, now: Date | number = Date.now()): string {
  const w = wallClockAt(new Date(now).getTime(), timeZone);
  return keyFromParts(w.year, w.month, w.day);
}

/** The wall-clock time in `timeZone` at `instant`, as `HH:mm`. */
export function wallTimeAt(timeZone: string, instant: Date | number): string {
  const w = wallClockAt(new Date(instant).getTime(), timeZone);
  return `${pad2(w.hour)}:${pad2(w.minute)}`;
}

/**
 * The instant at which the wall clock in `timeZone` reads `hhmm` on `dateKey`.
 *
 * DST is resolved the way Temporal's "compatible" option does: a time that
 * the spring-forward gap skips moves forward by the gap (02:30 on a Chicago
 * spring-forward day is 03:30 CDT), and a time the fall-back overlap repeats
 * takes its first occurrence (01:30 on a Chicago fall-back day is 01:30 CDT).
 */
export function zonedWallTimeToUtc(dateKey: string, hhmm: string, timeZone: string): Date {
  const [y, mo, d] = splitDateKey(dateKey);
  const t = WALL_TIME_RE.exec(hhmm);
  const hour = t ? Number(t[1]) : NaN;
  const minute = t ? Number(t[2]) : NaN;
  if (!(hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59)) {
    throw new RangeError(`Invalid wall time: ${hhmm}`);
  }

  const wallAsUtc = Date.UTC(y, mo - 1, d, hour, minute);
  // A day either side of the wall time brackets any single DST change.
  const offsetBefore = offsetAt(wallAsUtc - MS_PER_DAY, timeZone);
  const offsetAfter = offsetAt(wallAsUtc + MS_PER_DAY, timeZone);
  const candidates = [wallAsUtc - offsetBefore, wallAsUtc - offsetAfter].filter(
    (instant) => instant + offsetAt(instant, timeZone) === wallAsUtc,
  );

  if (candidates.length > 0) return new Date(Math.min(...candidates));
  // In the gap: apply the offset in force before it, which lands past it.
  return new Date(wallAsUtc - offsetBefore);
}

/** The instant `hhmm` falls at today in `timeZone`. */
export function wallTimeToday(hhmm: string, timeZone: string, now: Date | number = Date.now()): Date {
  return zonedWallTimeToUtc(todayKey(timeZone, now), hhmm, timeZone);
}

/**
 * The half-open UTC range [start, end) covering `dateKey` in `timeZone`, for
 * "everything on this day" queries. 23 or 25 hours long on DST change days.
 */
export function dayWindowUtc(dateKey: string, timeZone: string): { start: Date; end: Date } {
  return {
    start: zonedWallTimeToUtc(dateKey, '00:00', timeZone),
    end: zonedWallTimeToUtc(addDaysToKey(dateKey, 1), '00:00', timeZone),
  };
}

/**
 * The date key of the next occurrence of an annual date (a birthday, an
 * anniversary) on or after `fromKey`. `monthDay` is `MM-DD`, or any date key
 * or ISO date whose year is ignored. A 29 February date falls on 28 February
 * in years without one.
 */
export function nextAnnualOccurrence(monthDay: string, fromKey: string): string {
  const m = /^(?:\d{4}-)?(\d{2})-(\d{2})(?:$|T)/.exec(monthDay.trim());
  const month = m ? Number(m[1]) : NaN;
  const day = m ? Number(m[2]) : NaN;
  // 2000 is a leap year, so this accepts 02-29 and rejects 02-30.
  if (!m || !parseDateOnly(`2000-${m[1]}-${m[2]}`)) {
    throw new RangeError(`Invalid month-day: ${monthDay}`);
  }

  const occurrenceIn = (year: number) =>
    parseDateOnly(keyFromParts(year, month, day)) ?? keyFromParts(year, month, day - 1);

  const [fromYear] = splitDateKey(fromKey);
  const thisYear = occurrenceIn(fromYear);
  return thisYear >= fromKey ? thisYear : occurrenceIn(fromYear + 1);
}
