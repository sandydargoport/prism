'use client';

import { useEffect } from 'react';

/**
 * Sets up an interval that pauses when the page is hidden and resumes when visible.
 * Automatically refreshes data when the page becomes visible again.
 *
 * @param callback - Function to call on each interval tick
 * @param intervalMs - Interval in milliseconds (0 or negative to disable)
 */
export function useVisibilityPolling(
  callback: () => void,
  intervalMs: number
): void {
  useEffect(() => {
    if (intervalMs <= 0) return;

    let interval = setInterval(callback, intervalMs);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearInterval(interval);
      } else {
        callback();
        interval = setInterval(callback, intervalMs);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [intervalMs, callback]);
}
