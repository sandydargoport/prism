/**
 * The next occurrence of a stored birthday or anniversary, as calendar dates.
 *
 * Works on date keys only, so the answer depends on which day "today" is and
 * never on the zone the code runs in. Server callers pass
 * todayKey(await getHouseholdTimezone()).
 */

import { calendarDaysBetween, nextAnnualOccurrence, parseDateOnly } from './zonedDate';

/**
 * Years before this are not treated as real birth years. Synced entries with
 * no known year are stored as 1904 (see birthday-merge.ts).
 */
const FIRST_REAL_YEAR = 1910;

export type BirthdayOccurrence = {
  /** Date key of the next occurrence on or after today. */
  nextBirthday: string;
  /** Whole days until it: 0 today, 1 tomorrow. */
  daysUntil: number;
  /** Age turned (or years marked) on that occurrence; null when the year is unknown. */
  age: number | null;
};

/**
 * `birthDate` is the stored `YYYY-MM-DD` (an ISO string is accepted too).
 * Returns null when it is not a real calendar date.
 */
export function birthdayOccurrence(birthDate: string, today: string): BirthdayOccurrence | null {
  const key = parseDateOnly(birthDate);
  if (!key) return null;

  const nextBirthday = nextAnnualOccurrence(key, today);
  const birthYear = Number(key.slice(0, 4));
  const nextYear = Number(nextBirthday.slice(0, 4));
  const hasYear = birthYear >= FIRST_REAL_YEAR && birthYear <= Number(today.slice(0, 4));

  return {
    nextBirthday,
    daysUntil: calendarDaysBetween(today, nextBirthday),
    age: hasYear ? nextYear - birthYear : null,
  };
}
