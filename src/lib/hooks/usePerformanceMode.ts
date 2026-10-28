'use client';

import { useEffect, useRef } from 'react';
import { readStored, useHydrated, useStoredString, writeStored } from './useStoredValue';
import {
  PERF_AUTO_LEVEL_KEY, PERF_CLASS, PERF_MINIMAL_CLASS, PERF_MODE_KEY,
  autoLevelFrom, levelFrom, modeFrom, type PerfLevel, type PerfMode,
} from '@/lib/perfLevel';
import { afterFade, fadeWasBad, watchFrames, WATCH_MS } from '@/lib/autoPerf';

function applyClasses(level: PerfLevel): void {
  const classes = document.documentElement.classList;
  classes.toggle(PERF_CLASS, level !== 'full');
  classes.toggle(PERF_MINIMAL_CLASS, level === 'minimal');
}

function setMode(mode: PerfMode): void {
  writeStored(PERF_MODE_KEY, mode);
}

/**
 * The level this screen runs at (see lib/perfLevel.ts). Full during
 * hydration, as on the server, then the screen's own value.
 */
export function usePerformanceLevel(): PerfLevel {
  return levelFrom(useStoredString(PERF_MODE_KEY), useStoredString(PERF_AUTO_LEVEL_KEY));
}

/**
 * Whether the screen does less than everything: reduced or minimal. What
 * blur, celebrations and particle effects check.
 */
export function usePerformanceModeOn(): boolean {
  return usePerformanceLevel() !== 'full';
}

/**
 * The screen's performance mode and the level it runs at, persisted per screen
 * in localStorage and reflected as classes on <html>:
 *  - `performance-mode` at reduced and minimal: backdrop-filter is removed
 *    (the biggest GPU win on thin clients and integrated graphics)
 *  - `perf-minimal` at minimal: fades shortened. PhotoWidget and polling
 *    read the level directly.
 *
 * URL params, for kiosks and headless devices that can't reach Settings:
 *   ?perf=auto|full|reduced|minimal sets that mode; ?perf=1 and ?perf=0 still
 *   mean reduced and full. The param is removed from the address afterwards.
 *
 * Called inside ThemeProvider. The classes themselves are applied before the
 * first paint by the inline script in app/layout.tsx (PERF_CLASS_SCRIPT); this
 * hook runs in an effect, which is a frame too late for a screen with a
 * lighter level. What it still owns is the ?perf= override and keeping the
 * classes in step when the level changes.
 */
export function usePerformanceMode() {
  const mode = modeFrom(useStoredString(PERF_MODE_KEY));
  const level = usePerformanceLevel();
  const hydrated = useHydrated();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paramVal = params.get('perf');
    if (paramVal === null) return;
    const chosen = paramVal === '1' ? 'reduced' : paramVal === '0' ? 'full' : paramVal;
    if (chosen !== 'auto' && chosen !== 'full' && chosen !== 'reduced' && chosen !== 'minimal') return;
    setMode(chosen);
    params.delete('perf');
    const newSearch = params.toString();
    const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
    window.history.replaceState(null, '', newUrl);
  }, []);

  // Not while hydrating: the level is still the server's full then, and
  // removing the classes the inline script set would undo them for a frame.
  useEffect(() => {
    if (hydrated) applyClasses(level);
  }, [hydrated, level]);

  return { mode, level, setMode };
}

/** Bad fades so far, for this page view. A reload starts the count again. */
let badInARow = 0;

/**
 * Times the frames of the fade that follows each change of `idle`, and lets
 * Auto step down when fades keep dropping frames (see lib/autoPerf.ts).
 * Called by the Screensaver, which owns idleness for both kinds of idle screen.
 */
export function useAutoPerformance(idle: boolean): void {
  const mode = modeFrom(useStoredString(PERF_MODE_KEY));
  const hydrated = useHydrated();
  const seen = useRef(idle);
  useEffect(() => {
    // Only real changes: not the first render, and not a hidden tab, whose
    // frames the browser throttles on purpose.
    if (seen.current === idle) return;
    seen.current = idle;
    if (!hydrated || mode !== 'auto' || document.hidden) return;
    let cancelled = false;
    void watchFrames(WATCH_MS).then(gaps => {
      if (cancelled) return;
      const before = autoLevelFrom(readStored(PERF_AUTO_LEVEL_KEY));
      const next = afterFade({ level: before, badInARow }, fadeWasBad(gaps));
      badInARow = next.badInARow;
      if (next.level !== before) writeStored(PERF_AUTO_LEVEL_KEY, next.level);
    });
    return () => { cancelled = true; };
    // `idle` is the trigger: each change starts a fade worth timing.
  }, [idle, hydrated, mode]);
}
