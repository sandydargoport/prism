'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useStoredString, writeStored } from './useStoredValue';

const STORAGE_KEY = 'prism:auto-hide-ui';
const HIDE_DELAY = 10_000; // 10 seconds

/**
 * Returns whether the UI (nav + toolbar) should be hidden due to inactivity.
 * Only hides when the feature is enabled in settings.
 */
export function useAutoHideUI() {
  // False during hydration (the server cannot see storage), so the server
  // markup always matches.
  const enabled = useStoredString(STORAGE_KEY) === 'true';
  const [hidden, setHidden] = useState(false);
  const pathname = usePathname();
  // Only auto-hide on dashboard routes (/ and /d/[slug])
  const isDashboard = pathname === '/' || pathname.startsWith('/d/');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (!enabled) return;
    setHidden(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setHidden(true), HIDE_DELAY);
  }, [enabled]);

  const setEnabled = useCallback((value: boolean) => {
    // A timer that fired before the feature was turned off leaves `hidden`
    // true; clear it here so turning the feature back on starts visible.
    setHidden(false);
    writeStored(STORAGE_KEY, String(value));
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

    // Start the timer immediately. The UI is already showing, so there is
    // nothing to un-hide; only the countdown starts.
    timerRef.current = setTimeout(() => setHidden(true), HIDE_DELAY);

    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      window.removeEventListener('mousemove', moveHandler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, resetTimer]);

  // `hidden` can be left true by a timer that fired before the feature was
  // turned off (in another tab, say); gating on `enabled` here means it never
  // hides the UI then.
  return { autoHideEnabled: enabled, setAutoHideEnabled: setEnabled, uiHidden: enabled && isDashboard && hidden };
}
