'use client';

import { useEffect, useRef, useEffectEvent } from 'react';
import { format } from 'date-fns';
import { useLocalDateKey } from './useLocalDateKey';
import { getDisplayDateKey, toDisplayDate } from '@/lib/utils/timeFormat';

/**
 * Keep a calendar on today across midnight.
 *
 * The calendar's current date is set once, at mount. A wall display is never
 * reloaded, so the morning after it still showed yesterday as "today" and
 * its week or month did not move on. When the date changes, a calendar still
 * showing the previous day moves to the new one; one the user has navigated
 * elsewhere is left where it is.
 *
 * The check runs at the display zone's midnight.
 */
export function useFollowToday(
  currentDate: Date,
  setCurrentDate: (date: Date) => void,
  displayTimezone: string,
): void {
  const tick = useLocalDateKey(displayTimezone);
  const shownToday = useRef<string | null>(null);
  // Read when the day turns over, not a reason for the check to run.
  const isShowing = useEffectEvent((day: string) => format(currentDate, 'yyyy-MM-dd') === day);

  useEffect(() => {
    const today = getDisplayDateKey(new Date(), displayTimezone);
    const previous = shownToday.current;
    shownToday.current = today;
    if (previous && previous !== today && isShowing(previous)) {
      setCurrentDate(toDisplayDate(new Date(), displayTimezone));
    }
  }, [tick, displayTimezone, setCurrentDate]);
}
