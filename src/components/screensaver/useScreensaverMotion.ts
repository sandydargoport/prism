'use client';

import { useState, useEffect, useCallback } from 'react';

const KEY = 'prism-screensaver-motion';
const INTERVAL_KEY = 'prism-screensaver-motion-interval';
export const DEFAULT_MOTION_INTERVAL = 20;   // seconds between changes

export type ScreensaverMotion = 'off' | 'fade' | 'smoke' | 'liquid' | 'fireworks';

const VALID: ScreensaverMotion[] = ['off', 'fade', 'smoke', 'liquid', 'fireworks'];

/**
 * Earlier names, kept working. 'smoke' used to mean a plain opacity fade and
 * 'dissolve' meant the SVG-filter erosion; both now name something else, so a
 * display that was set before this change would otherwise silently switch
 * effect — or fall back to off — on an update.
 */
const RENAMED: Record<string, ScreensaverMotion> = {
  smoke: 'fade',      // the old "Fade in and out"
  dissolve: 'fireworks',
};

function normalise(raw: string | null, migrated: boolean): ScreensaverMotion | null {
  if (!raw) return null;
  if (!migrated && RENAMED[raw]) return RENAMED[raw]!;
  return (VALID as string[]).includes(raw) ? (raw as ScreensaverMotion) : null;
}

const MIGRATED_KEY = 'prism-screensaver-motion-v2';

/**
 * Whether the screensaver shows all its widgets at once (the original
 * behaviour) or shows a subset and rotates the membership, and how a widget
 * comes and goes when it does.
 *
 * Per display, like the screensaver's other settings: one screen in the house
 * may be the one people actually read and another may be pure ambience, and
 * they want different answers. Defaults to off so nobody's display changes
 * character on an update without them asking for it.
 */
export function useScreensaverMotion() {
  const [motion, setMotionState] = useState<ScreensaverMotion>('off');
  const [interval, setIntervalState] = useState(DEFAULT_MOTION_INTERVAL);

  // Read after mount, never during render: the server has no localStorage, so
  // reading it in the initialiser makes the first client render disagree with
  // the markup and React throws the tree away.
  useEffect(() => {
    try {
      const migrated = localStorage.getItem(MIGRATED_KEY) === '1';
      const m = normalise(localStorage.getItem(KEY), migrated);
      if (m) {
        setMotionState(m);
        if (!migrated) {
          localStorage.setItem(KEY, m);
          localStorage.setItem(MIGRATED_KEY, '1');
        }
      }
      const n = Number(localStorage.getItem(INTERVAL_KEY));
      if (n > 0) setIntervalState(n);
    } catch { /* storage unavailable */ }
  }, []);

  const setMotion = useCallback((v: ScreensaverMotion) => {
    setMotionState(v);
    try {
      localStorage.setItem(KEY, v);
      localStorage.setItem(MIGRATED_KEY, '1');
      window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: v }));
    } catch { /* storage unavailable */ }
  }, []);

  const setInterval = useCallback((v: number) => {
    setIntervalState(v);
    try {
      localStorage.setItem(INTERVAL_KEY, String(v));
      window.dispatchEvent(new StorageEvent('storage', { key: INTERVAL_KEY, newValue: String(v) }));
    } catch { /* storage unavailable */ }
  }, []);

  // Settings and the screensaver are separate trees; the storage event is how
  // a change made in one reaches the other without a reload.
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === KEY) {
        const m = normalise(e.newValue, true);
        if (m) setMotionState(m);
      }
      if (e.key === INTERVAL_KEY) { const n = Number(e.newValue); if (n > 0) setIntervalState(n); }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return { motion, setMotion, interval, setInterval };
}
