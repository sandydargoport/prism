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

/**
 * Return a presentation-only Date whose local fields match `date` in
 * `timeZone`. This is useful with date-fns, whose formatters always use the
 * browser timezone. Never persist or send the returned Date to an API.
 */
export function toDisplayDate(date: Date | number, timeZone?: string): Date {
  const source = new Date(date);
  if (!timeZone || Number.isNaN(source.getTime())) return source;

  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(source);
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

export function getDisplayDateKey(date: Date | number, timeZone?: string): string {
  return format(toDisplayDate(date, timeZone), 'yyyy-MM-dd');
}

function getUtcDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });

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

export function formatDisplayTime(
  date: Date | number,
  timeFormat: TimeFormat,
  options: { showSeconds?: boolean } = {},
  timeZone?: string,
): string {
  const { showSeconds = false } = options;
  const pattern = timeFormat === '24h'
    ? showSeconds ? 'HH:mm:ss' : 'HH:mm'
    : showSeconds ? 'h:mm:ss a' : 'h:mm a';
  return format(toDisplayDate(date, timeZone), pattern);
}

export function formatDisplayHour(
  date: Date | number,
  timeFormat: TimeFormat,
  options: { compact?: boolean } = {},
  timeZone?: string,
): string {
  const { compact = false } = options;
  const pattern = timeFormat === '24h'
    ? compact ? 'HH' : 'HH:mm'
    : compact ? 'ha' : 'h a';
  return format(toDisplayDate(date, timeZone), pattern);
}

export function formatDisplayTimeRange(
  start: Date | number,
  end: Date | number,
  timeFormat: TimeFormat,
  timeZone?: string,
): string {
  const displayStart = toDisplayDate(start, timeZone);
  const displayEnd = toDisplayDate(end, timeZone);
  if (timeFormat === '24h') {
    return `${format(displayStart, 'HH:mm')}–${format(displayEnd, 'HH:mm')}`;
  }
  return `${format(displayStart, 'h:mm')}–${format(displayEnd, 'h:mm a')}`;
}
