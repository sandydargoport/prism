import { format } from 'date-fns';

export type TimeFormat = '12h' | '24h';

export const DEFAULT_TIME_FORMAT: TimeFormat = '12h';

export function isTimeFormat(value: unknown): value is TimeFormat {
  return value === '12h' || value === '24h';
}

export function formatDisplayTime(
  date: Date | number,
  timeFormat: TimeFormat,
  options: { showSeconds?: boolean } = {},
): string {
  const { showSeconds = false } = options;
  const pattern = timeFormat === '24h'
    ? showSeconds ? 'HH:mm:ss' : 'HH:mm'
    : showSeconds ? 'h:mm:ss a' : 'h:mm a';
  return format(date, pattern);
}

export function formatDisplayHour(
  date: Date | number,
  timeFormat: TimeFormat,
  options: { compact?: boolean } = {},
): string {
  const { compact = false } = options;
  const pattern = timeFormat === '24h'
    ? compact ? 'HH' : 'HH:mm'
    : compact ? 'ha' : 'h a';
  return format(date, pattern);
}

export function formatDisplayTimeRange(
  start: Date | number,
  end: Date | number,
  timeFormat: TimeFormat,
): string {
  if (timeFormat === '24h') {
    return `${format(start, 'HH:mm')}–${format(end, 'HH:mm')}`;
  }
  return `${format(start, 'h:mm')}–${format(end, 'h:mm a')}`;
}
