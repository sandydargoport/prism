/**
 * All-day events are stored as UTC midnight of their first date, with an
 * exclusive end at UTC midnight of the day after their last ("floating").
 * Prism's own forms send exactly that. An API client may instead send local
 * instants: midnight in its zone, or an inclusive 23:59 end. Stored as-is,
 * those read back a day early west of UTC and a day late east of it.
 */

import { addDaysToKey, dateOnlyToFloatingUtc, floatingUtcToDateKey, todayKey, zonedWallTimeToUtc } from './zonedDate';

function isUtcMidnight(d: Date): boolean {
  return d.getTime() % 86_400_000 === 0;
}

/**
 * The floating range for an all-day event given as `start`/`end`. Values that
 * are already floating pass through unchanged; any other instant is read as
 * its date in `timeZone`. An end that is not a midnight is taken as the last
 * day (inclusive) and moved to the exclusive form. At least one day long.
 */
export function normalizeAllDayRange(start: Date, end: Date, timeZone: string): { start: Date; end: Date } {
  const startKey = isUtcMidnight(start) ? floatingUtcToDateKey(start) : todayKey(timeZone, start);

  let endKey: string;
  if (isUtcMidnight(end)) {
    endKey = floatingUtcToDateKey(end);
  } else {
    const endDay = todayKey(timeZone, end);
    const atMidnight = zonedWallTimeToUtc(endDay, '00:00', timeZone).getTime() === end.getTime();
    endKey = atMidnight ? endDay : addDaysToKey(endDay, 1);
  }
  if (endKey <= startKey) endKey = addDaysToKey(startKey, 1);

  return { start: dateOnlyToFloatingUtc(startKey), end: dateOnlyToFloatingUtc(endKey) };
}
