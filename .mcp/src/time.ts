/**
 * Time input and output for the MCP tools, in the household's time zone.
 *
 * A client asked for "3 PM tomorrow" knows the wall time, not the instant, so
 * the tools accept either:
 *
 *   - an instant with an explicit offset: `2026-10-04T15:00:00-05:00` or `...Z`
 *   - a wall time with no offset: `2026-10-04T15:00`, read in the household zone
 *   - a date `2026-10-04`, where a whole day is meant (all-day events, ranges)
 *
 * and send the Prism API what it expects: UTC ISO strings for instants, and the
 * floating UTC-midnight form for all-day dates (src/lib/utils/allDayRange.ts).
 *
 * The zone arithmetic mirrors src/lib/utils/zonedDate.ts. The MCP server is a
 * separate package and cannot import from the app, so it keeps its own copy;
 * the DST rule is the same (a skipped time moves forward by the gap, a
 * repeated time takes its first occurrence).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const WALL_RE = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?$/;
const OFFSET_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})$/i;

export const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

/** A time value the tools cannot use. The message is shown to the client. */
export class TimeInputError extends Error {}

type WallClock = { year: number; month: number; day: number; hour: number; minute: number; second: number };

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

function wallClockAt(instantMs: number, timeZone: string): WallClock {
  const parts = formatterFor(timeZone).formatToParts(new Date(instantMs));
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour') % 24,
    minute: value('minute'),
    second: value('second'),
  };
}

function offsetAt(instantMs: number, timeZone: string): number {
  const w = wallClockAt(instantMs, timeZone);
  const wallAsUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return wallAsUtc - Math.floor(instantMs / 1000) * 1000;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

function keyOf(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
}

/** `YYYY-MM-DD` if it names a real calendar date, else null. */
export function parseDateKey(value: string): string | null {
  const m = DATE_RE.exec(value.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null;
  return keyOf(y, mo, d);
}

function splitKey(dateKey: string): [number, number, number] {
  const key = parseDateKey(dateKey);
  if (!key) throw new TimeInputError(`Not a calendar date: ${dateKey}`);
  const m = DATE_RE.exec(key)!;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function addDaysToKey(dateKey: string, days: number): string {
  const [y, m, d] = splitKey(dateKey);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return keyOf(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekdayOfKey(dateKey: string): number {
  const [y, m, d] = splitKey(dateKey);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function startOfWeekKey(dateKey: string, weekStartsOn: 0 | 1): string {
  return addDaysToKey(dateKey, -((weekdayOfKey(dateKey) - weekStartsOn + 7) % 7));
}

/** The calendar date in `timeZone` at `now`. */
export function todayKey(timeZone: string, now: Date | number = Date.now()): string {
  const w = wallClockAt(new Date(now).getTime(), timeZone);
  return keyOf(w.year, w.month, w.day);
}

/** The wall clock in `timeZone` at `instant`, as `YYYY-MM-DDTHH:mm`. */
export function localDateTime(instant: Date | number | string, timeZone: string): string {
  const w = wallClockAt(new Date(instant).getTime(), timeZone);
  return `${keyOf(w.year, w.month, w.day)}T${pad2(w.hour)}:${pad2(w.minute)}`;
}

/** The instant at which the wall clock in `timeZone` reads the given time on `dateKey`. */
export function zonedWallTimeToUtc(dateKey: string, hour: number, minute: number, second: number, timeZone: string): Date {
  const [y, mo, d] = splitKey(dateKey);
  if (!(hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59)) {
    throw new TimeInputError(`Not a time of day: ${pad2(hour)}:${pad2(minute)}`);
  }
  const wallAsUtc = Date.UTC(y, mo - 1, d, hour, minute, second);
  const before = offsetAt(wallAsUtc - MS_PER_DAY, timeZone);
  const after = offsetAt(wallAsUtc + MS_PER_DAY, timeZone);
  const candidates = [wallAsUtc - before, wallAsUtc - after].filter(
    (instant) => instant + offsetAt(instant, timeZone) === wallAsUtc,
  );
  if (candidates.length > 0) return new Date(Math.min(...candidates));
  return new Date(wallAsUtc - before);
}

/** Whether a value carries its own offset, so it needs no zone to resolve. */
export function hasOffset(value: string): boolean {
  return OFFSET_RE.test(value.trim());
}

export function isDateOnly(value: string): boolean {
  return DATE_RE.test(value.trim());
}

/**
 * Resolve an instant given with an offset or as a household wall time.
 * `timeZone` is only consulted for a wall time.
 */
export function parseInstant(value: string, timeZone: string | null, field: string): Date {
  const v = value.trim();
  if (OFFSET_RE.test(v)) {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) throw new TimeInputError(`${field}: not a valid date-time: ${value}`);
    return d;
  }
  const m = WALL_RE.exec(v);
  if (m) {
    if (!timeZone) {
      throw new TimeInputError(
        `${field}: this Prism server does not report its household time zone, so a time without an offset cannot be placed. Send it with an offset, e.g. 2026-10-04T15:00:00-05:00.`,
      );
    }
    return zonedWallTimeToUtc(m[1], Number(m[2]), Number(m[3]), Number(m[4] ?? 0), timeZone);
  }
  throw new TimeInputError(
    `${field}: expected YYYY-MM-DDTHH:mm (household time) or an ISO date-time with an offset, got: ${value}`,
  );
}

/** The floating form of a date: UTC midnight of that calendar date. */
export function floatingUtc(dateKey: string): string {
  const [y, m, d] = splitKey(dateKey);
  return new Date(Date.UTC(y, m - 1, d)).toISOString();
}

/**
 * A bound for a date-range query. A date means the whole household day: its
 * first instant for a start, its last for an end. Anything else is an instant.
 */
export function rangeBound(value: string, timeZone: string | null, edge: 'start' | 'end', field: string): string {
  const key = parseDateKey(value);
  if (key) {
    if (!timeZone) {
      throw new TimeInputError(`${field}: a bare date needs the household time zone, which this server does not report. Send an ISO date-time with an offset.`);
    }
    if (edge === 'start') return zonedWallTimeToUtc(key, 0, 0, 0, timeZone).toISOString();
    const nextMidnight = zonedWallTimeToUtc(addDaysToKey(key, 1), 0, 0, 0, timeZone);
    return new Date(nextMidnight.getTime() - 1).toISOString();
  }
  if (isDateOnly(value)) throw new TimeInputError(`${field}: not a calendar date: ${value}`);
  return parseInstant(value, timeZone, field).toISOString();
}

/**
 * Start and end of an event as the events API wants them.
 *
 * All-day: dates go out in the floating form, with `end` taken as the last day
 * (inclusive) and sent as the exclusive midnight after it. A missing end means
 * a one-day event when `oneDayIfNoEnd` is set (creating; an update leaves the
 * stored end alone). An instant is passed through for the API to normalise.
 *
 * Timed: dates are refused, everything else resolves to a UTC instant.
 */
export function eventTimes(
  input: { startTime?: string; endTime?: string; allDay?: boolean },
  timeZone: string | null,
  oneDayIfNoEnd = false,
): { startTime?: string; endTime?: string } {
  const out: { startTime?: string; endTime?: string } = {};
  const { startTime, endTime, allDay } = input;

  for (const [field, value] of [['startTime', startTime], ['endTime', endTime]] as const) {
    if (value !== undefined && isDateOnly(value) && !allDay) {
      throw new TimeInputError(`${field}: a date without a time is only for all-day events; pass allDay: true, or give a time.`);
    }
  }

  if (startTime !== undefined) {
    const key = parseDateKey(startTime);
    out.startTime = key ? floatingUtc(key) : parseInstant(startTime, timeZone, 'startTime').toISOString();
  }
  if (endTime !== undefined) {
    const key = parseDateKey(endTime);
    out.endTime = key ? floatingUtc(addDaysToKey(key, 1)) : parseInstant(endTime, timeZone, 'endTime').toISOString();
  } else if (oneDayIfNoEnd && allDay && startTime !== undefined) {
    const key = parseDateKey(startTime);
    if (key) out.endTime = floatingUtc(addDaysToKey(key, 1));
  }
  return out;
}

function floatingKey(iso: string): string {
  const d = new Date(iso);
  return keyOf(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * An event as the API returns it, plus `localStart`/`localEnd` in the
 * household zone: `YYYY-MM-DDTHH:mm` for a timed event, and for an all-day
 * event the first and last dates (the last one inclusive).
 */
export function withLocalTimes<T extends Record<string, unknown>>(event: T, timeZone: string): T {
  const { startTime, endTime, allDay } = event as { startTime?: unknown; endTime?: unknown; allDay?: unknown };
  if (typeof startTime !== 'string' || typeof endTime !== 'string') return event;
  if (Number.isNaN(Date.parse(startTime)) || Number.isNaN(Date.parse(endTime))) return event;
  if (allDay === true) {
    const first = floatingKey(startTime);
    const exclusive = floatingKey(endTime);
    const last = exclusive > first ? addDaysToKey(exclusive, -1) : first;
    return { ...event, localStart: first, localEnd: last };
  }
  return { ...event, localStart: localDateTime(startTime, timeZone), localEnd: localDateTime(endTime, timeZone) };
}
