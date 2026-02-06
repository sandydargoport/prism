'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'prism-screensaver-timeout';
const DEFAULT_TIMEOUT = 120;

function getStoredTimeout(): number {
  if (typeof window === 'undefined') return DEFAULT_TIMEOUT;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored !== null ? Number(stored) : DEFAULT_TIMEOUT;
}

export function useIdleDetection(initialTimeout?: number) {
  const [timeout, setTimeoutValue] = useState(() => initialTimeout ?? getStoredTimeout());
  const [isIdle, setIsIdle] = useState(false);
  const forcedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for timeout changes from settings
  useEffect(() => {
    const handler = (e: CustomEvent<number>) => {
      setTimeoutValue(e.detail);
    };
    window.addEventListener('prism:screensaver-timeout-change', handler as EventListener);
    return () => window.removeEventListener('prism:screensaver-timeout-change', handler as EventListener);
  }, []);

  // Reset idle timer on user activity (restarts countdown)
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
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
    if (timeout <= 0) return;

    // Mousemove/scroll only reset the idle timer, they don't dismiss the screensaver
    const moveEvents = ['mousemove', 'scroll'] as const;
    moveEvents.forEach((e) => window.addEventListener(e, resetTimer));

    // Click/key/touch dismiss the screensaver AND reset the timer
    const dismissEvents = ['mousedown', 'keydown', 'touchstart'] as const;
    dismissEvents.forEach((e) => window.addEventListener(e, dismissIdle));

    resetTimer();

    return () => {
      moveEvents.forEach((e) => window.removeEventListener(e, resetTimer));
      dismissEvents.forEach((e) => window.removeEventListener(e, dismissIdle));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer, dismissIdle, timeout]);

  // Listen for custom screensaver activation event
  useEffect(() => {
    const handler = () => forceIdle();
    window.addEventListener('prism:screensaver', handler);
    return () => window.removeEventListener('prism:screensaver', handler);
  }, [forceIdle]);

  return { isIdle, forceIdle };
}
