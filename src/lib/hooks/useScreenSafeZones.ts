'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

// --- Public types (consumed by LayoutPreview, LayoutGridEditor, etc.) ---

export interface ScreenSafeZone {
  name: string;
  rows: number;
  cols: number;
  color: string;
}

export interface ScreenSafeZones {
  landscape: ScreenSafeZone[];
  portrait: ScreenSafeZone[];
}

// --- Config types (stored in localStorage) ---

export interface ScreenZoneConfig {
  name: string;   // e.g. "16:9 (1080p)", "4:3 (iPad)"
  width: number;  // resolution width in pixels
  height: number; // resolution height in pixels
  color: string;
}

interface ScreenSafeZonesConfig {
  screens: ScreenZoneConfig[];
}

// --- Defaults (different aspect ratios) ---

export const DEFAULT_SCREENS: ScreenZoneConfig[] = [
  { name: '16:9 (1080p)',    width: 1920, height: 1080, color: '#3B82F6' },
  { name: '3:2 (Surface)',   width: 1500, height: 1000, color: '#EF4444' },
  { name: '16:10 (MacBook)', width: 2560, height: 1600, color: '#F59E0B' },
  { name: '4:3 (iPad)',      width: 2048, height: 1536, color: '#22C55E' },
];

export const RESOLUTION_PRESETS: { label: string; width: number; height: number }[] = [
  { label: '16:9 (1080p)',    width: 1920, height: 1080 },
  { label: '16:9 (4K)',       width: 3840, height: 2160 },
  { label: '3:2 (Surface)',   width: 1500, height: 1000 },
  { label: '16:10 (MacBook)', width: 2560, height: 1600 },
  { label: '4:3 (iPad)',      width: 2048, height: 1536 },
];

// --- Storage ---

const STORAGE_KEY = 'prism:screen-safe-zones';

// --- Computation ---
// The grid is responsive with react-grid-layout breakpoints:
//   lg (>=1200px): 12 cols, md (>=996px): 9 cols, sm (>=768px): 6 cols, xs (<768px): 3 cols
// Cell size = screenWidth / cols, cells are square.
// Visible rows = screenHeight / cellSize = cols * screenHeight / screenWidth.
// In landscape, all reasonable screens are >=1200px → 12 cols.
// In portrait, narrower screens hit lower breakpoints → fewer cols.

function getBreakpointCols(screenWidth: number): number {
  if (screenWidth >= 1200) return 12;
  if (screenWidth >= 996) return 9;
  if (screenWidth >= 768) return 6;
  return 3;
}

export function computeZones(
  screens: ScreenZoneConfig[],
  orientation: 'landscape' | 'portrait'
): ScreenSafeZone[] {
  return screens.map(s => {
    // In landscape, width = wider dimension; in portrait, width = narrower dimension
    const w = orientation === 'landscape'
      ? Math.max(s.width, s.height)
      : Math.min(s.width, s.height);
    const h = orientation === 'landscape'
      ? Math.min(s.width, s.height)
      : Math.max(s.width, s.height);
    const cols = getBreakpointCols(w);
    return {
      name: s.name,
      cols,
      rows: Math.min(Math.round(cols * h / w), 50),
      color: s.color,
    };
  });
}

// --- Migration + loading ---

function isOldFormat(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return Array.isArray(obj.landscape) || Array.isArray(obj.portrait);
}

function loadScreens(): ScreenZoneConfig[] {
  if (typeof window === 'undefined') return DEFAULT_SCREENS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Migrate old format (had landscape/portrait with rows/cols) → use defaults
      if (isOldFormat(parsed)) {
        return DEFAULT_SCREENS;
      }
      const config = parsed as ScreenSafeZonesConfig;
      if (config.screens?.length) {
        return config.screens;
      }
    }
  } catch { /* use defaults */ }
  return DEFAULT_SCREENS;
}

// --- Backward-compat export ---

export const DEFAULT_SCREEN_SAFE_ZONES: ScreenSafeZones = {
  landscape: computeZones(DEFAULT_SCREENS, 'landscape'),
  portrait: computeZones(DEFAULT_SCREENS, 'portrait'),
};

// --- Hook ---

export function useScreenSafeZones() {
  const [screens, setScreensState] = useState<ScreenZoneConfig[]>(loadScreens);

  // Sync from localStorage on mount (SSR hydration safety)
  useEffect(() => {
    setScreensState(loadScreens());
  }, []);

  // Listen for changes from other components/tabs
  useEffect(() => {
    const handler = (e: Event) => {
      if (e instanceof CustomEvent) {
        setScreensState(e.detail as ScreenZoneConfig[]);
      }
    };
    window.addEventListener('prism:screen-safe-zones-change', handler);
    return () => window.removeEventListener('prism:screen-safe-zones-change', handler);
  }, []);

  const setScreens = useCallback((newScreens: ScreenZoneConfig[]) => {
    setScreensState(newScreens);
    try {
      const config: ScreenSafeZonesConfig = { screens: newScreens };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      window.dispatchEvent(new CustomEvent('prism:screen-safe-zones-change', { detail: newScreens }));
    } catch { /* ignore storage errors */ }
  }, []);

  const resetToDefaults = useCallback(() => {
    setScreens(DEFAULT_SCREENS);
  }, [setScreens]);

  // Compute zones from screens (aspect-ratio-based, no reference needed)
  const zones: ScreenSafeZones = useMemo(() => ({
    landscape: computeZones(screens, 'landscape'),
    portrait: computeZones(screens, 'portrait'),
  }), [screens]);

  // All zone names (for toggle buttons in layout designer)
  const allSizeNames = useMemo(() =>
    screens.map(s => s.name),
  [screens]);

  return { zones, screens, setScreens, resetToDefaults, allSizeNames };
}
