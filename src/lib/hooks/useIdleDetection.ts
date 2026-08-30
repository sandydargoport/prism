'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useIsPWA } from './useIsPWA';

const STORAGE_KEY = 'prism-screensaver-timeout';
const AWAY_MODE_STORAGE_KEY = 'prism-away-mode-timeout';
const LAST_ACTIVITY_KEY = 'prism-last-activity';
const DEFAULT_TIMEOUT = 0;

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

  useEffect(() => {
    if (timeout <= 0 || isPWA) return;

    // Mousemove/scroll only reset the idle timer, they don't dismiss the screensaver
    const moveEvents = ['mousemove', 'scroll'] as const;
    moveEvents.forEach((e) => window.addEventListener(e, resetTimer));

    // Click/key/touch dismiss the screensaver AND reset the timer — EXCEPT when
    // the interaction targets an opt-in "keep-alive" control (e.g. the calendar
    // view switcher), so those can be operated in place without exiting the
    // screensaver. Checking the native event target covers portaled controls
    // (like the view popover, which renders under <body>) that stopPropagation
    // on the React tree would miss.
    const maybeDismiss = (e: Event) => {
      const target = e.target as Element | null;
      if (target && typeof target.closest === 'function' && target.closest('[data-screensaver-keep]')) {
        return;
      }
      dismissIdle();
    };
    const dismissEvents = ['pointerdown', 'mousedown', 'keydown', 'touchstart'] as const;
    dismissEvents.forEach((e) => window.addEventListener(e, maybeDismiss));

    resetTimer();

    return () => {
      moveEvents.forEach((e) => window.removeEventListener(e, resetTimer));
      dismissEvents.forEach((e) => window.removeEventListener(e, maybeDismiss));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer, dismissIdle, timeout, isPWA]);

  // Kiosk announcements commonly navigate/refresh the page or bring a hidden
  // page back to the foreground. Exit immediately so their UI is never covered.
  useEffect(() => {
    const wake = () => { forcedRef.current = false; setIsIdle(false); resetTimer(); };
    const onVisibility = () => wake();
    window.addEventListener('pageshow', wake);
    window.addEventListener('popstate', wake);
    window.addEventListener('hashchange', wake);
    window.addEventListener('prism:announce', wake);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pageshow', wake);
      window.removeEventListener('popstate', wake);
      window.removeEventListener('hashchange', wake);
      window.removeEventListener('prism:announce', wake);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [resetTimer]);

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
      const lastActivity = getLastActivity();
      const hoursSinceActivity = (Date.now() - lastActivity) / (1000 * 60 * 60);

      if (hoursSinceActivity >= awayModeTimeout) {
        try {
          // Check if already in away mode
          const stateRes = await fetch('/api/away-mode');
          if (stateRes.ok) {
            const state = await stateRes.json();
            if (!state.enabled) {
              // Activate away mode
              await fetch('/api/away-mode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: true, autoActivated: true }),
              });
              // Notify components
              window.dispatchEvent(new Event('prism:away-mode-change'));
            }
          }
        } catch {
          // Ignore errors - away mode is optional
        }
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
