'use client';

import { useEffect } from 'react';
import { readStored, useHydrated, useStoredString, writeStored } from './useStoredValue';

const STORAGE_KEY = 'prism-perf-mode';
const HTML_CLASS = 'performance-mode';

function detectLowEndHardware(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2) return true;
  if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4) return true;
  return false;
}

function applyClass(on: boolean): void {
  document.documentElement.classList.toggle(HTML_CLASS, on);
}

function setEnabled(on: boolean): void {
  writeStored(STORAGE_KEY, String(on));
}

/**
 * Whether performance mode is on, for a component that only reads it. False
 * during hydration, as on the server, then the display's own value.
 */
export function usePerformanceModeOn(): boolean {
  return useStoredString(STORAGE_KEY) === 'true';
}

/**
 * Persists a "performance mode" preference to localStorage and reflects it
 * as a CSS class on <html>. When enabled:
 *  - backdrop-filter is removed (biggest GPU win on thin clients / integrated graphics)
 *  - PhotoWidget renders count + last thumbnail only
 *  - Polling cadence stretches (see usePollingInterval)
 *  - TravelGlobe falls back to a flat 2D projection
 *
 * Auto-detect: on first load (no localStorage value), enables itself if
 * navigator.deviceMemory <= 2 OR hardwareConcurrency <= 4. The result is
 * persisted, so a user who explicitly turns it off is not re-overridden.
 *
 * URL params (for kiosks / headless devices that can't reach Settings):
 *   ?perf=1 → force-enable and persist
 *   ?perf=0 → force-disable and persist
 *
 * Every instance reads the same store, so a change made in one reaches all.
 *
 * Called inside ThemeProvider. The class itself is applied before the first
 * paint by the inline script in app/layout.tsx, alongside the dark class —
 * this hook runs in an effect, which is a frame too late for a display that
 * has performance mode on. What it still owns is the auto-detect on a display
 * with nothing stored, the ?perf= URL overrides, and keeping `enabled` in
 * sync across hook instances.
 *
 * `enabled` is false while hydrating, as on the server, so component-level
 * branches on it (PhotoWidget, TravelGlobe) render their full version for that
 * one frame. On a client-side mount it is right from the first render.
 */
export function usePerformanceMode() {
  const enabled = usePerformanceModeOn();
  const hydrated = useHydrated();

  // The ?perf= override and the first-load auto-detect. Both are writes, which
  // every instance then reads back.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paramVal = params.get('perf');

    if (paramVal === '1' || paramVal === '0') {
      setEnabled(paramVal === '1');
      params.delete('perf');
      const newSearch = params.toString();
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
      window.history.replaceState(null, '', newUrl);
    } else {
      const stored = readStored(STORAGE_KEY);
      if (stored !== 'true' && stored !== 'false') setEnabled(detectLowEndHardware());
    }
  }, []);

  // Not while hydrating: `enabled` is still the server's false then, and
  // removing the class the inline script set would undo it for a frame.
  useEffect(() => {
    if (hydrated) applyClass(enabled);
  }, [hydrated, enabled]);

  return { enabled, setEnabled };
}
