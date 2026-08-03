'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';

const STORAGE_KEY = 'prism:auto-hide-ui';
const HIDE_DELAY = 10_000; // 10 seconds

/**
 * Returns whether the UI (nav + toolbar) should be hidden due to inactivity.
 * Only hides when the feature is enabled in settings.
 */
export function useAutoHideUI() {
  const [enabled, setEnabledState] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  // Only auto-hide on dashboard routes (/ and /d/[slug])
  const isDashboard = pathname === '/' || pathname.startsWith('/d/');

  // Read from localStorage after mount to avoid SSR hydration mismatch
  useEffect(() => {
    setEnabledState(localStorage.getItem(STORAGE_KEY) === 'true');
    setMounted(true);
  }, []);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (!enabled) return;
    setHidden(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setHidden(true), HIDE_DELAY);
  }, [enabled]);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    localStorage.setItem(STORAGE_KEY, String(value));
    if (!value) {
      setHidden(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const events = ['mousedown', 'touchstart', 'keydown', 'scroll'] as const;
    const handler = () => resetTimer();
    events.forEach(e => window.addEventListener(e, handler, { passive: true }));

    // Also reveal on pointer MOVEMENT (throttled). Without this, the hidden
    // toolbar can only be un-hidden by a click — but a click on the collapsed
    // (max-h-0) header lands on the dashboard behind it and never reaches the
    // control the user aimed for, so the first click just "wakes" the UI and
    // seems to do nothing (e.g. the F11 kiosk edit-layout button, #21).
    // Moving toward a control now brings the chrome up before the click.
    // A still cursor emits no mousemove, so idle auto-hide still engages, and
    // a touch-only kiosk (no mousemove) is unaffected.
    let lastMove = 0;
    const moveHandler = () => {
      const now = performance.now();
      if (now - lastMove < 400) return;
      lastMove = now;
      resetTimer();
    };
    window.addEventListener('mousemove', moveHandler, { passive: true });

    // Start the timer immediately
    resetTimer();

    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      window.removeEventListener('mousemove', moveHandler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, resetTimer]);

  // Listen for cross-component setting changes
  useEffect(() => {
    const handler = () => {
      const val = localStorage.getItem(STORAGE_KEY) === 'true';
      setEnabledState(val);
      if (!val) setHidden(false);
    };
    window.addEventListener('storage', handler);
    window.addEventListener('prism:auto-hide-change', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('prism:auto-hide-change', handler);
    };
  }, []);

  return { autoHideEnabled: enabled, setAutoHideEnabled: setEnabled, uiHidden: mounted && enabled && isDashboard && hidden };
}
