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
