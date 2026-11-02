/**
 * Repeating events stored as one series row (#59).
 *
 * A synced calendar sends each occurrence as its own row, which names its
 * series in `seriesKey`. A repeating event made in Prism is stored once
 * instead, as the series' first occurrence plus its RRULE, with no series
 * key: kept in Prism (a Prism calendar, or one the series could not be added
 * to), or added to Google or CalDAV and waiting for the next sync to replace
 * it with the calendar's own occurrences. These helpers turn that row into
 * the occurrences a date range shows.
 *
 * The rule repeats in the household's wall time, so a 9:00 weekly event stays
 * at 9:00 across a clock change. All-day rows are floating dates (UTC midnight
 * of the calendar date, see zonedDate.ts) and repeat as dates.
 */

import ICAL from 'ical.js';
import { floatingUtcToDateKey, wallTimeAt, todayKey, zonedWallTimeToUtc } from './zonedDate';

export { occurrenceId, parseEventId } from './occurrenceId';

/** Most occurrences one series contributes to a range. */
const MAX_OCCURRENCES = 1_000;
/** Most iterator steps spent on one series, in or out of the range. */
const MAX_STEPS = 10_000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The fields of an event row that say whether and how it repeats. */
export type SeriesRow = {
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  recurrenceRule: string | null;
  seriesKey: string | null;
};

/** True for a series row, which Prism expands, rather than one synced occurrence. */
export function isSeriesRow(row: Pick<SeriesRow, 'recurrenceRule' | 'seriesKey'>): boolean {
  return Boolean(row.recurrenceRule?.trim()) && !row.seriesKey;
}

/** Parse a stored rule, tolerating the `RRULE:` prefix Google's form carries. */
function parseRule(rule: string): ICAL.Recur | null {
  try {
    return ICAL.Recur.fromString(rule.trim().replace(/^RRULE:/i, ''));
  } catch {
    return null;
  }
}

/** A stored start as a floating ICAL time in the household zone's wall clock. */
function toWallTime(instant: Date, allDay: boolean, timeZone: string): ICAL.Time {
  const key = allDay ? floatingUtcToDateKey(instant) : todayKey(timeZone, instant);
  const [year, month, day] = key.split('-').map(Number) as [number, number, number];
  if (allDay) return ICAL.Time.fromData({ year, month, day, isDate: true });
  const [hour, minute] = wallTimeAt(timeZone, instant).split(':').map(Number) as [number, number];
  return ICAL.Time.fromData({ year, month, day, hour, minute, second: instant.getUTCSeconds() });
}

/** A floating ICAL time back to the instant Prism stores. */
function fromWallTime(time: ICAL.Time, allDay: boolean, timeZone: string): Date {
  const key = `${String(time.year).padStart(4, '0')}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')}`;
  if (allDay) return new Date(Date.UTC(time.year, time.month - 1, time.day));
  const hhmm = `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
  return new Date(zonedWallTimeToUtc(key, hhmm, timeZone).getTime() + time.second * 1000);
}

/**
 * The occurrences of a repeating row that overlap [rangeStart, rangeEnd], in
 * order, each the length of the stored first one. A row that does not repeat,
 * or whose rule cannot be read, yields the row itself when it overlaps.
 */
export function expandSeries(
  row: Pick<SeriesRow, 'startTime' | 'endTime' | 'allDay' | 'recurrenceRule'>,
  rangeStart: Date,
  rangeEnd: Date,
  timeZone: string,
): Array<{ start: Date; end: Date }> {
  const lengthMs = Math.max(0, row.endTime.getTime() - row.startTime.getTime());
  const overlaps = (start: Date, end: Date) => end >= rangeStart && start <= rangeEnd;
  const single = overlaps(row.startTime, row.endTime) ? [{ start: row.startTime, end: row.endTime }] : [];

  const rule = row.recurrenceRule ? parseRule(row.recurrenceRule) : null;
  if (!rule || !rule.freq) return single;

  // A UTC UNTIL compared with a floating time would be read as if the wall
  // clock were UTC, hours off. Restate it as the household's wall time.
  if (rule.until && rule.until.zone === ICAL.Timezone.utcTimezone && !rule.until.isDate) {
    rule.until = toWallTime(rule.until.toJSDate(), row.allDay, timeZone);
  }

  const dtstart = toWallTime(row.startTime, row.allDay, timeZone);

  // A daily or weekly rule without COUNT repeats with a fixed period in
  // wall-clock days, so a series that began long ago can skip whole periods
  // instead of walking every occurrence since. The skip stays a period plus
  // the event's length (and two days for zone offsets) before the range.
  let from = dtstart;
  if (!rule.count && (rule.freq === 'DAILY' || rule.freq === 'WEEKLY')) {
    const periodDays = (rule.interval || 1) * (rule.freq === 'WEEKLY' ? 7 : 1);
    const latest = rangeStart.getTime() - lengthMs - (periodDays + 2) * DAY_MS;
    const periods = Math.floor((latest - row.startTime.getTime()) / (periodDays * DAY_MS));
    if (periods > 0) {
      from = dtstart.clone();
      from.adjust(periods * periodDays, 0, 0, 0);
    }
  }
  const steps = rule.iterator(from);

  const out: Array<{ start: Date; end: Date }> = [];
  let walked = 0;
  for (let next = steps.next(); next; next = steps.next()) {
    if (++walked > MAX_STEPS || out.length >= MAX_OCCURRENCES) break;
    const start = fromWallTime(next, row.allDay, timeZone);
    if (start > rangeEnd) break;
    const end = new Date(start.getTime() + lengthMs);
    if (overlaps(start, end)) out.push({ start, end });
  }
  return out;
}
