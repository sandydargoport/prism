import { format } from 'date-fns';

export type TimeFormat = '12h' | '24h';
export type DisplayTimezoneMode = 'household' | 'device';

export const DEFAULT_TIME_FORMAT: TimeFormat = '12h';
export const DEFAULT_DISPLAY_TIMEZONE_MODE: DisplayTimezoneMode = 'household';

export function isTimeFormat(value: unknown): value is TimeFormat {
  return value === '12h' || value === '24h';
}

export function isDisplayTimezoneMode(value: unknown): value is DisplayTimezoneMode {
  return value === 'household' || value === 'device';
}

// Constructing an Intl.DateTimeFormat is expensive (~1ms), and the calendar
// helpers call the wall-clock conversion per event per visible day, so building
// a formatter per call turns a month view into seconds of jank. Cache one
// formatter per timezone; formatToParts on a cached instance is cheap.
const wallClockFormatterCache = new Map<string, Intl.DateTimeFormat>();
export function getWallClockFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = wallClockFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    wallClockFormatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/**
 * Return a presentation-only Date whose local fields match `date` in
 * `timeZone`. This is useful with date-fns, whose formatters always use the
 * browser timezone. Never persist or send the returned Date to an API.
 *
 * A wall time that falls in the device's own spring-forward gap does not
 * exist as a local Date and comes back an hour later. Its date is still
 * right; for a time label use formatDisplayTime, which reads the zone's
 * clock directly.
 */
export function toDisplayDate(date: Date | number, timeZone?: string): Date {
  const source = new Date(date);
  if (!timeZone || Number.isNaN(source.getTime())) return source;

  try {
    const parts = getWallClockFormatter(timeZone).formatToParts(source);
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);

    return new Date(
      value('year'),
      value('month') - 1,
      value('day'),
      value('hour'),
      value('minute'),
      value('second'),
      source.getMilliseconds(),
    );
  } catch {
    return source;
  }
}

/**
 * Minutes between two instants as the wall clock in `timeZone` reads them,
 * for drawing a timed event on an hour grid. On a DST change day this differs
 * from the elapsed time: 01:00 to 03:00 on a spring-forward morning is one
 * hour long but covers two rows of the grid, and a block sized by elapsed
 * time stopped at 02:00. Falls back to elapsed minutes for an unknown zone.
 */
export function wallClockMinutesBetween(start: Date | number, end: Date | number, timeZone?: string): number {
  const elapsed = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
  if (!timeZone) return elapsed;
  try {
    const wallMs = (date: Date | number) => {
      const parts = getWallClockFormatter(timeZone).formatToParts(new Date(date));
      const value = (type: Intl.DateTimeFormatPartTypes) =>
        Number(parts.find((part) => part.type === type)?.value);
      return Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'));
    };
    return (wallMs(end) - wallMs(start)) / 60000;
  } catch {
    return elapsed;
  }
}

export function getDisplayDateKey(date: Date | number, timeZone?: string): string {
  const source = new Date(date);
  if (!timeZone || Number.isNaN(source.getTime())) return format(source, 'yyyy-MM-dd');
  try {
    const parts = getWallClockFormatter(timeZone).formatToParts(source);
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value;
    return `${value('year')}-${value('month')}-${value('day')}`;
  } catch {
    return format(source, 'yyyy-MM-dd');
  }
}

function getUtcDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convert a DATE value that a parser built at server-local midnight (node-ical
 * and ical.js both do) into the floating all-day form the helpers below read:
 * UTC midnight of the same calendar date. Server-side only, since the local
 * fields are the process timezone's.
 */
/**
 * A local Date for labelling the day an event starts on. An all-day event's
 * start is UTC midnight of its date, read here with the UTC getters: through
 * toDisplayDate it would be the previous evening west of UTC, and its label
 * a day early. A timed event is its wall clock in `timeZone`.
 */
export function eventStartDisplayDate(startTime: Date, allDay: boolean, timeZone?: string): Date {
  if (allDay) {
    return new Date(startTime.getUTCFullYear(), startTime.getUTCMonth(), startTime.getUTCDate());
  }
  return toDisplayDate(startTime, timeZone);
}

export function localDateToFloatingAllDay(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

function nextUtcDateKey(date: Date): string {
  return getUtcDateKey(new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
  )));
}

function getAllDayExclusiveEndKey(eventStart: Date, eventEnd: Date): string {
  const startKey = getUtcDateKey(eventStart);
  const endIsExclusiveMidnight = eventEnd > eventStart
    && eventEnd.getUTCHours() === 0
    && eventEnd.getUTCMinutes() === 0
    && eventEnd.getUTCSeconds() === 0
    && eventEnd.getUTCMilliseconds() === 0;
  const endKey = endIsExclusiveMidnight
    ? getUtcDateKey(eventEnd)
    : nextUtcDateKey(eventEnd);

  return endKey > startKey ? endKey : nextUtcDateKey(eventStart);
}

/** Return true when an event occupies more than one displayed calendar day. */
export function eventSpansMultipleDisplayDays(
  start: Date | number,
  end: Date | number,
  allDay: boolean,
  timeZone?: string,
): boolean {
  const eventStart = new Date(start);
  const eventEnd = new Date(end);
  if (
    Number.isNaN(eventStart.getTime())
    || Number.isNaN(eventEnd.getTime())
    || eventEnd <= eventStart
  ) return false;

  if (allDay) {
    return getAllDayExclusiveEndKey(eventStart, eventEnd) > nextUtcDateKey(eventStart);
  }

  // An event ending exactly at midnight does not occupy the following day.
  const inclusiveEnd = new Date(eventEnd.getTime() - 1);
  return getDisplayDateKey(eventStart, timeZone) !== getDisplayDateKey(inclusiveEnd, timeZone);
}

/** Return true when an event begins on the supplied displayed calendar day. */
export function eventStartsOnDisplayDay(
  start: Date | number,
  allDay: boolean,
  day: Date,
  timeZone?: string,
): boolean {
  const eventStart = new Date(start);
  if (Number.isNaN(eventStart.getTime())) return false;

  const dayKey = format(day, 'yyyy-MM-dd');
  return allDay
    ? getUtcDateKey(eventStart) === dayKey
    : getDisplayDateKey(eventStart, timeZone) === dayKey;
}

/**
 * Return true when an event has completely finished from the viewer's
 * perspective. All-day ranges use their floating, exclusive end date; timed
 * events use their real instant. An event that is still in progress is never
 * treated as past.
 */
export function isCalendarEventPast(
  start: Date | number,
  end: Date | number,
  allDay: boolean,
  now: Date | number = new Date(),
  timeZone?: string,
): boolean {
  const eventStart = new Date(start);
  const eventEnd = new Date(end);
  const current = new Date(now);
  if (
    Number.isNaN(eventStart.getTime())
    || Number.isNaN(eventEnd.getTime())
    || Number.isNaN(current.getTime())
  ) return false;

  if (allDay) {
    return getAllDayExclusiveEndKey(eventStart, eventEnd) <= getDisplayDateKey(current, timeZone);
  }

  return eventEnd <= current;
}

/**
 * Test whether an event belongs to a displayed calendar day.
 *
 * All-day events are floating date ranges: their UTC date fields are the
 * intended calendar dates and must not be shifted into the display timezone.
 * Google uses an exclusive midnight end, while Prism also accepts its legacy
 * inclusive end-of-day representation.
 */
export function eventOccursOnDisplayDay(
  start: Date | number,
  end: Date | number,
  allDay: boolean,
  day: Date,
  timeZone?: string,
): boolean {
  const eventStart = new Date(start);
  const eventEnd = new Date(end);
  if (Number.isNaN(eventStart.getTime()) || Number.isNaN(eventEnd.getTime())) return false;

  if (allDay) {
    const dayKey = format(day, 'yyyy-MM-dd');
    const startKey = getUtcDateKey(eventStart);
    const endExclusiveKey = getAllDayExclusiveEndKey(eventStart, eventEnd);

    return dayKey >= startKey && dayKey < endExclusiveKey;
  }

  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const displayStart = toDisplayDate(eventStart, timeZone);
  const displayEnd = toDisplayDate(eventEnd, timeZone);
  return displayStart < dayEnd && displayEnd > dayStart;
}

/**
 * Convert date/time fields entered in the selected display timezone into the
 * real instant that should be persisted. This is the inverse of
 * `toDisplayDate` for calendar form values.
 */
export function fromDisplayDateTime(
  date: string,
  time: string,
  timeZone?: string,
): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute, second = 0] = time.split(':').map(Number);

  if (![year, month, day, hour, minute, second].every(Number.isFinite)) {
    return new Date(NaN);
  }

  if (!timeZone) return new Date(year!, month! - 1, day!, hour!, minute!, second!);

  const targetWallTime = Date.UTC(year!, month! - 1, day!, hour!, minute!, second!);
  let instant = targetWallTime;

  try {
    const formatter = getWallClockFormatter(timeZone);

    // A second pass handles dates where the first offset guess crosses a DST
    // boundary. Three passes keep the operation stable for unusual offsets.
    for (let pass = 0; pass < 3; pass += 1) {
      const parts = formatter.formatToParts(new Date(instant));
      const value = (type: Intl.DateTimeFormatPartTypes) =>
        Number(parts.find((part) => part.type === type)?.value);
      const displayedWallTime = Date.UTC(
        value('year'),
        value('month') - 1,
        value('day'),
        value('hour'),
        value('minute'),
        value('second'),
      );
      const correction = displayedWallTime - targetWallTime;
      if (correction === 0) break;
      instant -= correction;
    }

    return new Date(instant);
  } catch {
    return new Date(year!, month! - 1, day!, hour!, minute!, second!);
  }
}

/**
 * Hour, minute and second on the wall clock in `timeZone`, or on the device's
 * clock without one. Read from the zone directly rather than through
 * toDisplayDate: a wall time in the device's spring-forward gap does not exist
 * as a local Date, so 02:30 in the display zone came out as 03:30.
 */
function wallClockTime(date: Date | number, timeZone?: string): { hour: number; minute: number; second: number } {
  const source = new Date(date);
  if (timeZone && !Number.isNaN(source.getTime())) {
    try {
      const parts = getWallClockFormatter(timeZone).formatToParts(source);
      const value = (type: Intl.DateTimeFormatPartTypes) =>
        Number(parts.find((part) => part.type === type)?.value);
      return { hour: value('hour'), minute: value('minute'), second: value('second') };
    } catch {
      // An unknown zone: fall through to the device's clock, as toDisplayDate does.
    }
  }
  return { hour: source.getHours(), minute: source.getMinutes(), second: source.getSeconds() };
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const hour12 = (hour: number) => (hour % 12 === 0 ? 12 : hour % 12);
const meridiem = (hour: number) => (hour < 12 ? 'AM' : 'PM');

export function formatDisplayTime(
  date: Date | number,
  timeFormat: TimeFormat,
  options: { showSeconds?: boolean } = {},
  timeZone?: string,
): string {
  const { showSeconds = false } = options;
  const { hour, minute, second } = wallClockTime(date, timeZone);
  const seconds = showSeconds ? `:${pad2(second)}` : '';
  return timeFormat === '24h'
    ? `${pad2(hour)}:${pad2(minute)}${seconds}`
    : `${hour12(hour)}:${pad2(minute)}${seconds} ${meridiem(hour)}`;
}

/**
 * A date and time, e.g. "Sep 28, 2026, 8:30 PM", in `timeZone` and the
 * household's 12/24-hour format. For timestamps the server recorded (a sync,
 * a backup, a message), which toLocaleString would show in the device zone.
 */
export function formatDisplayDateTime(
  date: Date | number,
  timeFormat: TimeFormat,
  timeZone?: string,
): string {
  return `${format(toDisplayDate(date, timeZone), 'MMM d, yyyy')}, ${formatDisplayTime(date, timeFormat, {}, timeZone)}`;
}

export function formatDisplayHour(
  date: Date | number,
  timeFormat: TimeFormat,
  options: { compact?: boolean } = {},
  timeZone?: string,
): string {
  const { compact = false } = options;
  const { hour, minute } = wallClockTime(date, timeZone);
  if (timeFormat === '24h') return compact ? pad2(hour) : `${pad2(hour)}:${pad2(minute)}`;
  return compact ? `${hour12(hour)}${meridiem(hour)}` : `${hour12(hour)} ${meridiem(hour)}`;
}

export function formatDisplayTimeRange(
  start: Date | number,
  end: Date | number,
  timeFormat: TimeFormat,
  timeZone?: string,
): string {
  const s = wallClockTime(start, timeZone);
  const e = wallClockTime(end, timeZone);
  if (timeFormat === '24h') {
    return `${pad2(s.hour)}:${pad2(s.minute)}–${pad2(e.hour)}:${pad2(e.minute)}`;
  }
  return `${hour12(s.hour)}:${pad2(s.minute)}–${hour12(e.hour)}:${pad2(e.minute)} ${meridiem(e.hour)}`;
}
