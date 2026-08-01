import { parseISO, getDay, addDays, format } from 'date-fns';
import { DAYS_OF_WEEK } from '@/lib/constants/days';

/**
 * The absolute calendar date (YYYY-MM-DD) of a meal, derived from its stored
 * `weekOf` (a week-start date) and `dayOfWeek` name.
 *
 * A meal falls on the single occurrence of its weekday within the
 * [weekOf, weekOf + 6] window — regardless of which weekday `weekOf` itself is
 * (it depends on the user's "week starts on" preference at add time). Mirrors
 * the backfill in migration 0020; getDay()/DAYS_OF_WEEK are both Sunday-first
 * (0 = Sunday).
 */
export function mealDate(weekOf: string, dayOfWeek: string): string {
  const base = parseISO(weekOf);
  const targetDow = DAYS_OF_WEEK.indexOf(dayOfWeek as (typeof DAYS_OF_WEEK)[number]);
  if (targetDow < 0) return weekOf; // unknown day name — fall back to the week start
  const offset = (targetDow - getDay(base) + 7) % 7;
  return format(addDays(base, offset), 'yyyy-MM-dd');
}
