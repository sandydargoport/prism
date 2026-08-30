'use client';

import { useState, useEffect } from 'react';

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

export function useLocalDateKey(): string {
  const [key, setKey] = useState(() => localDateKey());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const schedule = () => {
      timer = setTimeout(() => {
        // Recomputed from the clock rather than incremented, so a device that
        // slept through midnight still lands on the correct date.
        setKey(localDateKey());
        schedule();
      }, msUntilNextLocalMidnight());
    };

    schedule();

    // A machine waking from sleep may have missed the timer entirely.
    const onWake = () => setKey(localDateKey());
    document.addEventListener('visibilitychange', onWake);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onWake);
    };
  }, []);

  return key;
}
