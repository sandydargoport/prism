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
const FLOOR_KEY = 'prism-screensaver-min-widgets';
const CEILING_KEY = 'prism-screensaver-max-widgets';
const OUTLINES_KEY = 'prism-screensaver-outlines';
const SHORTCUT_KEY = 'prism-screensaver-shortcut';
export const DEFAULT_FLOOR = 2;
export const DEFAULT_CEILING = 0;   // 0 = no cap

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
  const [floor, setFloorState] = useState(DEFAULT_FLOOR);
  const [ceiling, setCeilingState] = useState(DEFAULT_CEILING);
  const [outlines, setOutlinesState] = useState(true);
  // Off by default. The screensaver is what a room looks like when nobody is
  // using it, and putting a control on it changes that for every display on
  // update — the same reason the effects themselves default to off.
  const [shortcut, setShortcutState] = useState(false);

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
      const lo = Number(localStorage.getItem(FLOOR_KEY));
      if (lo > 0) setFloorState(lo);
      const hi = Number(localStorage.getItem(CEILING_KEY));
      if (hi >= 0 && localStorage.getItem(CEILING_KEY) !== null) setCeilingState(hi);
      if (localStorage.getItem(OUTLINES_KEY) === 'off') setOutlinesState(false);
      if (localStorage.getItem(SHORTCUT_KEY) === 'on') setShortcutState(true);
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

  const setFloor = useCallback((v: number) => {
    setFloorState(v);
    try {
      localStorage.setItem(FLOOR_KEY, String(v));
      window.dispatchEvent(new StorageEvent('storage', { key: FLOOR_KEY, newValue: String(v) }));
    } catch { /* storage unavailable */ }
  }, []);

  const setCeiling = useCallback((v: number) => {
    setCeilingState(v);
    try {
      localStorage.setItem(CEILING_KEY, String(v));
      window.dispatchEvent(new StorageEvent('storage', { key: CEILING_KEY, newValue: String(v) }));
    } catch { /* storage unavailable */ }
  }, []);

  const setOutlines = useCallback((v: boolean) => {
    setOutlinesState(v);
    try {
      localStorage.setItem(OUTLINES_KEY, v ? 'on' : 'off');
      window.dispatchEvent(new StorageEvent('storage', { key: OUTLINES_KEY, newValue: v ? 'on' : 'off' }));
    } catch { /* storage unavailable */ }
  }, []);

  const setShortcut = useCallback((v: boolean) => {
    setShortcutState(v);
    try {
      localStorage.setItem(SHORTCUT_KEY, v ? 'on' : 'off');
      window.dispatchEvent(new StorageEvent('storage', { key: SHORTCUT_KEY, newValue: v ? 'on' : 'off' }));
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
      if (e.key === FLOOR_KEY) { const n = Number(e.newValue); if (n > 0) setFloorState(n); }
      if (e.key === CEILING_KEY) { const n = Number(e.newValue); if (n >= 0) setCeilingState(n); }
      if (e.key === OUTLINES_KEY) setOutlinesState(e.newValue !== 'off');
      if (e.key === SHORTCUT_KEY) setShortcutState(e.newValue === 'on');
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return {
    motion, setMotion,
    interval, setInterval,
    floor, setFloor,
    ceiling, setCeiling,
    outlines, setOutlines,
    shortcut, setShortcut,
  };
}
