'use client';

import { useContext, useEffect, useRef } from 'react';
import { usePollingInterval } from './usePollingInterval';
import { useDisplayIdle } from './useDisplayIdle';
import { PollingScopeContext } from './pollingScope';

/**
 * Sets up an interval that pauses while nothing is displaying the data, and
 * resumes with a single catch-up refresh.
 *
 * Two things pause it: the tab being hidden, and the screensaver being up (see
 * useDisplayIdle for why the second one is needed at all). Either way the
 * timer is cleared rather than left running into a void, and coming back runs
 * the callback exactly ONCE — not once per tick that was missed, which on a
 * display idle overnight would be hundreds.
 *
 * The provided interval is automatically stretched when Performance Mode is on
 * (see usePollingInterval). Callers pass their natural default; the hook
 * applies the stretch globally so weak-hardware tuning is centralized.
 *
 * @param callback - Function to call on each interval tick
 * @param intervalMs - Interval in milliseconds (0 or negative to disable)
 * @param options.pollWhileIdle - Keep polling while the screensaver is up. For
 *   the house-wide switches that decide what the display shows at all: Away
 *   and Babysitter mode are turned on from someone's phone, and a display that
 *   only noticed on the next touch would leave a babysitter looking at holiday
 *   photos. They are one small request a minute, so they are worth the
 *   exception; widget data is not.
 */
export function useVisibilityPolling(
  callback: () => void,
  intervalMs: number,
  options: { pollWhileIdle?: boolean } = {}
): void {
  const effectiveInterval = usePollingInterval(intervalMs);
  const scope = useContext(PollingScopeContext);
  const displayIdle = useDisplayIdle();
  // The screensaver's widgets are what the idle display is showing, so they are
  // the one set that must not pause with it.
  const exempt = scope === 'screensaver' || options.pollWhileIdle === true;
  const paused = exempt ? false : displayIdle;

  // The callback is read at tick time rather than captured, so a caller whose
  // identity changes on every render (most of them close over fetch params)
  // cannot restart the timer. Restarting resets the countdown, and a callback
  // that changes faster than the interval means the tick never arrives at all.
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  // Whether the last state we saw was paused, so resuming can tell a genuine
  // resume from an interval change. Starts false: mounting is not a resume,
  // and every caller already fetches on mount.
  const wasPaused = useRef(false);

  useEffect(() => {
    if (effectiveInterval <= 0) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const run = () => {
      stop();
      if (paused || document.hidden) {
        wasPaused.current = true;
        return;
      }
      if (wasPaused.current) {
        wasPaused.current = false;
        callbackRef.current();
      }
      timer = setInterval(() => callbackRef.current(), effectiveInterval);
    };

    run();

    document.addEventListener('visibilitychange', run);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', run);
    };
  }, [effectiveInterval, paused]);
}
