/**
 * Locale-aware date labels.
 *
 * date-fns `format` renders English month and weekday names, and, worse, the
 * pattern itself fixes the field order. `format(d, 'MMMM d, yyyy')` is
 * "September 4, 2026" in every language, but German writes "4. September 2026".
 * A translated catalogue cannot fix that, because the order lives in the code.
 *
 * So every human-readable date label goes through Intl.DateTimeFormat, which
 * takes both the names and the order from the locale. date-fns stays for
 * machine keys (`yyyy-MM-dd` bucket lookups), where English is the point.
 *
 * Constructing an Intl.DateTimeFormat costs ~1ms and a month view asks for
 * dozens per render, so formatters are cached per locale + style: the same
 * trick timeFormat.ts uses for its wall-clock formatter.
 */

const STYLES = {
  weekdayShort: { weekday: 'short' },
  weekdayLong: { weekday: 'long' },
  weekdayNarrow: { weekday: 'narrow' },
  monthShort: { month: 'short' },
  monthLong: { month: 'long' },
  monthYear: { month: 'long', year: 'numeric' },
  monthDay: { month: 'short', day: 'numeric' },
  monthDayYear: { month: 'short', day: 'numeric', year: 'numeric' },
  weekdayMonthDay: { weekday: 'short', month: 'short', day: 'numeric' },
  weekdayLongMonthDay: { weekday: 'long', month: 'long', day: 'numeric' },
  fullDate: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

export type DateStyle = keyof typeof STYLES;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(locale: string, style: DateStyle): Intl.DateTimeFormat {
  const cacheKey = `${locale}|${style}`;
  let formatter = formatterCache.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, STYLES[style]);
    formatterCache.set(cacheKey, formatter);
  }
  return formatter;
}

/** Format `date` in `locale` using one of the shared semantic styles. */
export function formatDateStyle(date: Date, style: DateStyle, locale: string): string {
  return getFormatter(locale, style).format(date);
}

/**
 * Weekday name for a day index (0 = Sunday, matching Date.getDay() and
 * DAYS_SHORT_ARRAY), for column headers that have a weekday but no date.
 * 2024-01-07 was a Sunday. The formatter renders in the local zone, so the
 * date is built at local noon: UTC noon is already the next day at UTC+13 and
 * +14, which named every column one day late there.
 */
export function weekdayNameByIndex(
  index: number,
  locale: string,
  style: 'weekdayShort' | 'weekdayLong' | 'weekdayNarrow' = 'weekdayShort',
): string {
  return formatDateStyle(new Date(2024, 0, 7 + index, 12), style, locale);
}

/**
 * A date range as one label: "Sep 1 – Sep 14, 2026" in English,
 * "1. Sep. – 14. Sep. 2026" in German. formatRange collapses the parts the two
 * ends share, which is exactly what the old `${a} - ${b}` string faked.
 */
export function formatDateRange(start: Date, end: Date, locale: string): string {
  return getFormatter(locale, 'monthDayYear').formatRange(start, end);
}
