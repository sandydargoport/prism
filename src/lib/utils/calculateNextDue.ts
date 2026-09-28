import {
  addDays,
  addWeeks,
  addMonths,
  format,
  nextSunday,
  nextMonday,
  nextTuesday,
  nextWednesday,
  nextThursday,
  nextFriday,
  nextSaturday,
  startOfMonth,
  setDate,
  setMonth,
  setYear,
  getDate,
  getMonth,
  getYear,
  isBefore,
} from 'date-fns';
import { parseDateOnly } from './zonedDate';

const dayFunctions = [nextSunday, nextMonday, nextTuesday, nextWednesday, nextThursday, nextFriday, nextSaturday];

export type ChoreFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'semi-annually' | 'annually' | 'custom';

/**
 * Calculate the next due date based on frequency and optional startDay override.
 * - weekly: next occurrence of startDay (0=Sun, 1=Mon, ..., 6=Sat), default Sunday
 * - monthly: next occurrence of day-of-month (1-28), default 1st
 * - annually: next occurrence of MM-DD, default same month-day next year
 * - daily/custom: just add the interval
 *
 * @param frequency - The chore frequency
 * @param customIntervalDays - For 'custom' frequency, number of days between occurrences
 * @param startDay - Override for target day (varies by frequency type)
 * @param fromKey - Today as a date key (YYYY-MM-DD). Server callers pass
 *   todayKey(getHouseholdTimezone()), so a chore completed in the evening is
 *   scheduled from the household's today, not the server's.
 */
export function calculateNextDue(
  frequency: ChoreFrequency,
  customIntervalDays: number | null | undefined,
  startDay: string | null | undefined,
  fromKey: string,
): string {
  const key = parseDateOnly(fromKey);
  if (!key) throw new RangeError(`Invalid date key: ${fromKey}`);
  // The arithmetic below reads and writes only the calendar date, on the
  // local clock. Noon keeps it clear of any zone whose DST change falls at
  // midnight, so the result is the same in every process zone.
  const [y, m, d] = key.split('-').map(Number);
  const today = new Date(y!, m! - 1, d!, 12);
  let nextDate: Date;

  switch (frequency) {
    case 'daily':
      nextDate = addDays(today, 1);
      break;

    case 'weekly': {
      // startDay: 0=Sunday, 1=Monday, ..., 6=Saturday (default 0)
      const targetDay = startDay ? parseInt(startDay, 10) : 0;
      const dayFn = dayFunctions[targetDay] || nextSunday;
      nextDate = dayFn(today);
      break;
    }

    case 'biweekly': {
      // For biweekly, use startDay for the target day, then add 2 weeks from last occurrence
      const targetDay = startDay ? parseInt(startDay, 10) : 0;
      const dayFn = dayFunctions[targetDay] || nextSunday;
      const nextWeekDay = dayFn(today);
      // Add one more week to make it biweekly
      nextDate = addWeeks(nextWeekDay, 1);
      break;
    }

    case 'monthly': {
      // startDay: day of month (1-28), default 1
      const targetDom = startDay ? Math.min(28, Math.max(1, parseInt(startDay, 10))) : 1;
      const currentDom = getDate(today);
      if (currentDom < targetDom) {
        // Still this month
        nextDate = setDate(today, targetDom);
      } else {
        // Next month
        nextDate = setDate(addMonths(today, 1), targetDom);
      }
      break;
    }

    case 'quarterly': {
      // Next quarter's first day, or use startDay as day-of-month
      const targetDom = startDay ? Math.min(28, Math.max(1, parseInt(startDay, 10))) : 1;
      const nextQ = addMonths(startOfMonth(today), 3);
      nextDate = setDate(nextQ, targetDom);
      break;
    }

    case 'semi-annually': {
      const targetDom = startDay ? Math.min(28, Math.max(1, parseInt(startDay, 10))) : 1;
      const next6 = addMonths(startOfMonth(today), 6);
      nextDate = setDate(next6, targetDom);
      break;
    }

    case 'annually': {
      // startDay: "MM-DD" format, e.g., "03-15" for March 15
      let targetMonth = getMonth(today);
      let targetDom = getDate(today);

      if (startDay && startDay.includes('-')) {
        const [mm, dd] = startDay.split('-');
        targetMonth = Math.max(0, Math.min(11, parseInt(mm!, 10) - 1));
        targetDom = Math.max(1, Math.min(28, parseInt(dd!, 10)));
      }

      let candidate = setDate(setMonth(today, targetMonth), targetDom);
      if (isBefore(candidate, addDays(today, 1))) {
        // Already passed this year, go to next year
        candidate = setYear(candidate, getYear(today) + 1);
      }
      nextDate = candidate;
      break;
    }

    case 'custom':
      nextDate = addDays(today, customIntervalDays || 1);
      break;

    default:
      nextDate = addDays(today, 1);
  }

  return format(nextDate, 'yyyy-MM-dd');
}
