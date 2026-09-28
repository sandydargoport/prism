'use client';

import { useState, useEffect, useMemo } from 'react';
import { dayWindowUtc, addDaysToKey, todayKey } from '@/lib/utils/zonedDate';

/**
 * A value that changes when the local date does.
 *
 * Several hooks compute a request window from `new Date()` inside a `useMemo`
 * whose dependencies are all constants, so the window is fixed at mount. On a
 * page someone opens and closes that is invisible. On a wall display, which is
 * never reloaded, it means the dashboard is still asking for the window it
 * computed whenever it last started — days or weeks ago. "Today" on screen
 * quietly stops being today.
 *
 * Depending on this key in that memo makes the window roll over at midnight.
 *
 * Deliberately a date string rather than a timestamp: it changes exactly once
 * per day, so it cannot cause a refetch for any other reason.
 */
export function localDateKey(now: Date = new Date()): string {
  // Local components, not toISOString — that is UTC, and would roll over at
  // the wrong moment for anyone not on UTC.
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Milliseconds until the next local midnight, plus a second of slack. */
export function msUntilNextLocalMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0);
  // Date arithmetic on local components handles daylight-saving shifts: the
  // clock jumping an hour changes the distance to midnight, not the date.
  return Math.max(1000, next.getTime() - now.getTime());
}

/**
 * The date key in `timeZone` at `now`, or in the device zone when there is no
 * zone or it is not a valid one.
 */
export function zonedDateKey(timeZone?: string, now: Date = new Date()): string {
  if (timeZone) {
    try {
      return todayKey(timeZone, now);
    } catch {
      // An unknown zone name: fall through to the device's date.
    }
  }
  return localDateKey(now);
}

/**
 * Milliseconds until the next midnight in `timeZone`, plus a second of slack.
 * The device's midnight when there is no zone or it is not a valid one.
 */
export function msUntilNextMidnight(timeZone?: string, now: Date = new Date()): number {
  if (timeZone) {
    try {
      const tomorrow = addDaysToKey(todayKey(timeZone, now), 1);
      const next = dayWindowUtc(tomorrow, timeZone).start.getTime() + 1000;
      return Math.max(1000, next - now.getTime());
    } catch {
      // An unknown zone name: fall through to the device's midnight.
    }
  }
  return msUntilNextLocalMidnight(now);
}

/**
 * The current date key, changing at midnight. With `timeZone` (normally the
 * display zone from useTimeFormat) it is that zone's date and changes at that
 * zone's midnight; without one, the device's.
 */
export function useLocalDateKey(timeZone?: string): string {
  // Bumped at each midnight and on wake. The key is derived from the clock
  // rather than stored, so a change of zone after mount (the household zone
  // arriving from the server, or the display mode being switched) is taken
  // up on the next render.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const schedule = () => {
      timer = setTimeout(() => {
        // The key is read from the clock, not counted, so a device that slept
        // through midnight still lands on the correct date.
        setTick((n) => n + 1);
        schedule();
      }, msUntilNextMidnight(timeZone));
    };

    schedule();

    // A machine waking from sleep may have missed the timer entirely.
    const onWake = () => setTick((n) => n + 1);
    document.addEventListener('visibilitychange', onWake);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onWake);
    };
  }, [timeZone]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- tick is the clock
  return useMemo(() => zonedDateKey(timeZone), [timeZone, tick]);
}
