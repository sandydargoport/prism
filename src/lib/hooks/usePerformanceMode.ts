'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'prism-perf-mode';
const HTML_CLASS = 'performance-mode';
const CHANGE_EVENT = 'prism:performance-mode-change';

interface PerformanceModeChangeDetail {
  enabled: boolean;
}

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

function broadcast(on: boolean): void {
  window.dispatchEvent(
    new CustomEvent<PerformanceModeChangeDetail>(CHANGE_EVENT, { detail: { enabled: on } }),
  );
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
 * Multiple consumer hook instances stay in sync via a 'prism:performance-mode-change'
 * window event; mutations from any instance propagate to all others.
 *
 * Called inside ThemeProvider. The class itself is applied before the first
 * paint by the inline script in app/layout.tsx, alongside the dark class —
 * this hook runs in an effect, which is a frame too late for a display that
 * has performance mode on. What it still owns is the auto-detect on a display
 * with nothing stored, the ?perf= URL overrides, and keeping `enabled` in
 * sync across hook instances.
 *
 * `enabled` itself is still false for the first render, so component-level
 * branches on it (PhotoWidget, TravelGlobe) render their full version for one
 * frame. The page-wide backdrop-filter cost is the one that mattered and that
 * is handled above; the rest would need this state hydrated synchronously.
 */
export function usePerformanceMode() {
  const [enabled, setEnabledState] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paramVal = params.get('perf');

    let on: boolean;
    if (paramVal === '1' || paramVal === '0') {
      on = paramVal === '1';
      localStorage.setItem(STORAGE_KEY, String(on));
      params.delete('perf');
      const newSearch = params.toString();
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
      window.history.replaceState(null, '', newUrl);
    } else {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'true' || stored === 'false') {
        on = stored === 'true';
      } else {
        on = detectLowEndHardware();
        localStorage.setItem(STORAGE_KEY, String(on));
      }
    }

    setEnabledState(on);
    applyClass(on);

    const handleChange = (e: Event) => {
      const detail = (e as CustomEvent<PerformanceModeChangeDetail>).detail;
      if (typeof detail?.enabled === 'boolean') {
        setEnabledState(detail.enabled);
      }
    };
    window.addEventListener(CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(CHANGE_EVENT, handleChange);
  }, []);

  const setEnabled = useCallback((on: boolean) => {
    setEnabledState(on);
    localStorage.setItem(STORAGE_KEY, String(on));
    applyClass(on);
    broadcast(on);
  }, []);

  return { enabled, setEnabled };
}
