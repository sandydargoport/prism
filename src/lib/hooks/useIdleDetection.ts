'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useIsPWA } from './useIsPWA';

const STORAGE_KEY = 'prism-screensaver-timeout';
const AWAY_MODE_STORAGE_KEY = 'prism-away-mode-timeout';
const LAST_ACTIVITY_KEY = 'prism-last-activity';
const DEFAULT_TIMEOUT = 120;

function getStoredTimeout(): number {
  if (typeof window === 'undefined') return DEFAULT_TIMEOUT;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored !== null ? Number(stored) : DEFAULT_TIMEOUT;
}

function getAwayModeTimeout(): number {
  if (typeof window === 'undefined') return 0;
  const stored = localStorage.getItem(AWAY_MODE_STORAGE_KEY);
  return stored !== null ? Number(stored) : 0;
}

function updateLastActivity() {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  }
}

function getLastActivity(): number {
  if (typeof window === 'undefined') return Date.now();
  const stored = localStorage.getItem(LAST_ACTIVITY_KEY);
  return stored !== null ? Number(stored) : Date.now();
}

export function useIdleDetection(initialTimeout?: number) {
  const isPWA = useIsPWA();
  const [timeout, setTimeoutValue] = useState(() => initialTimeout ?? getStoredTimeout());
  const [awayModeTimeout, setAwayModeTimeout] = useState(() => getAwayModeTimeout());
  const [isIdle, setIsIdle] = useState(false);
  const forcedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const awayModeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Listen for timeout changes from settings
  useEffect(() => {
    const handler = (e: CustomEvent<number>) => {
      setTimeoutValue(e.detail);
    };
    window.addEventListener('prism:screensaver-timeout-change', handler as EventListener);
    return () => window.removeEventListener('prism:screensaver-timeout-change', handler as EventListener);
  }, []);

  // Listen for away mode timeout changes from settings
  useEffect(() => {
    const handler = (e: CustomEvent<number>) => {
      setAwayModeTimeout(e.detail);
    };
    window.addEventListener('prism:away-mode-timeout-change', handler as EventListener);
    return () => window.removeEventListener('prism:away-mode-timeout-change', handler as EventListener);
  }, []);

  // Reset idle timer on user activity (restarts countdown)
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    // Update last activity for away mode tracking
    updateLastActivity();
    if (timeout > 0) {
      timerRef.current = setTimeout(() => setIsIdle(true), timeout * 1000);
    }
  }, [timeout]);

  // Dismiss idle state on deliberate interaction (click, keydown, touch)
  const dismissIdle = useCallback(() => {
    if (!forcedRef.current) {
      setIsIdle(false);
    }
    // After forceIdle, first deliberate interaction clears the flag,
    // second one actually dismisses. This prevents the mouseup from
    // the screensaver button from immediately dismissing.
    if (forcedRef.current) {
      forcedRef.current = false;
      return;
    }
    setIsIdle(false);
    resetTimer();
  }, [resetTimer]);

  const forceIdle = useCallback(() => {
    forcedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsIdle(true);
  }, []);

  // Dismissal is registered ALWAYS — including in a PWA, and including when
  // the timeout is "Never".
  //
  // The screensaver can be opened deliberately from the toolbar button, which
  // dispatches 'prism:screensaver' and is not gated on either condition. When
  // this effect skipped registration, that button had no counterpart: nothing
  // anywhere could clear isIdle, so an installed app was stuck on the
  // screensaver until it was force-closed. The auto-idle TIMER below is still
  // skipped on a PWA, which is the documented intent (a phone has no idle
  // state, and auto-locking someone out of their own device is wrong) — but
  // that intent never implied "cannot be dismissed".
  useEffect(() => {
    const maybeDismiss = (e: Event) => {
      // Record activity before the keep-region check, not after it.
      //
      // Activity is otherwise only written by resetTimer(), which dismissIdle()
      // calls — so every interaction that reaches dismissIdle already counted.
      // Taps inside a data-screensaver-keep region return below WITHOUT
      // reaching it, which made the calendar's on-screensaver view controls the
      // one way to use the display without the display noticing. That guard
      // exists so the overlay is not dismissed; it was never meant to mean
      // nobody is standing here.
      updateLastActivity();
      const target = e.target as Element | null;
      if (target && typeof target.closest === 'function' && target.closest('[data-screensaver-keep]')) {
        return;
      }
      dismissIdle();
    };
    const dismissEvents = ['mousedown', 'keydown', 'touchstart'] as const;
    // Passive: none of these call preventDefault, and a non-passive touchstart
    // on window makes the browser wait on JS before it can scroll. Every other
    // activity hook in the codebase already does this.
    dismissEvents.forEach((e) => window.addEventListener(e, maybeDismiss, { passive: true }));
    return () => {
      dismissEvents.forEach((e) => window.removeEventListener(e, maybeDismiss));
    };
  }, [dismissIdle]);

  useEffect(() => {
    if (timeout <= 0 || isPWA) return;

    // Mousemove/scroll only reset the idle timer, they don't dismiss the screensaver
    const moveEvents = ['mousemove', 'scroll'] as const;
    moveEvents.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));

    resetTimer();

    return () => {
      moveEvents.forEach((e) => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer, timeout, isPWA]);

  // Listen for custom screensaver activation event
  useEffect(() => {
    const handler = () => forceIdle();
    window.addEventListener('prism:screensaver', handler);
    return () => window.removeEventListener('prism:screensaver', handler);
  }, [forceIdle]);

  // Away mode auto-activation based on extended inactivity
  useEffect(() => {
    if (awayModeTimeout <= 0 || isPWA) {
      // Clear timer if disabled
      if (awayModeTimerRef.current) {
        clearInterval(awayModeTimerRef.current);
        awayModeTimerRef.current = null;
      }
      return;
    }

    const checkAwayMode = async () => {
      try {
        // Ask the server first. Activity is per-browser, but Away Mode is one
        // switch for the whole house, so the decision cannot be made from local
        // state alone: someone turning it off at the wall display has to count
        // against every other client's idle clock, or the most neglected tab in
        // the house wins and turns it straight back on.
        const stateRes = await fetch('/api/away-mode');
        if (!stateRes.ok) return;
        const state = await stateRes.json();
        if (state.enabled) return;

        const disabledAt = state.disabledAt ? Date.parse(state.disabledAt) : 0;
        const lastActivity = Math.max(getLastActivity(), Number.isNaN(disabledAt) ? 0 : disabledAt);
        const hoursSinceActivity = (Date.now() - lastActivity) / (1000 * 60 * 60);

        if (hoursSinceActivity >= awayModeTimeout) {
          await fetch('/api/away-mode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: true, autoActivated: true }),
          });
          window.dispatchEvent(new Event('prism:away-mode-change'));
        }
      } catch {
        // Ignore errors - away mode is optional
      }
    };

    // Check every minute
    awayModeTimerRef.current = setInterval(checkAwayMode, 60 * 1000);
    // Also check immediately
    checkAwayMode();

    return () => {
      if (awayModeTimerRef.current) {
        clearInterval(awayModeTimerRef.current);
        awayModeTimerRef.current = null;
      }
    };
  }, [awayModeTimeout, isPWA]);

  return { isIdle, forceIdle };
}
