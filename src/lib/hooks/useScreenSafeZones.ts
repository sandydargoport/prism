'use client';

import { useCallback, useMemo } from 'react';
import { parseStored, useStoredString, writeStored } from './useStoredValue';

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
  { name: '1080p', width: 1920, height: 1080, color: '#3B82F6' },
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
// The grid uses a 48-column CSS Grid layout.
// On narrower screens, fewer columns may be used:
// Cell size = screenWidth / cols, cells are square.
// Visible rows = screenHeight / cellSize = cols * screenHeight / screenWidth.
// In landscape, all reasonable screens are >=1200px → 48 cols.
// In portrait, narrower screens hit lower breakpoints → fewer cols.

function getBreakpointCols(screenWidth: number): number {
  if (screenWidth >= 1200) return 48;
  if (screenWidth >= 996) return 36;
  if (screenWidth >= 768) return 24;
  return 12;
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
      // Cap at 64 = the canonical 9:16 portrait canvas (36×64). A lower cap
      // truncated the guide so 9:16 portrait templates (rows 50–64) spilled past
      // the blue perimeter markers in the editor.
      rows: Math.min(Math.round(cols * h / w), 64),
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

function toScreens(raw: string | null): ScreenZoneConfig[] {
  const parsed = parseStored(STORAGE_KEY, raw);
  if (!parsed || typeof parsed !== 'object') return DEFAULT_SCREENS;
  // Migrate old format (had landscape/portrait with rows/cols) → use defaults
  if (isOldFormat(parsed)) return DEFAULT_SCREENS;
  const config = parsed as ScreenSafeZonesConfig;
  return config.screens?.length ? config.screens : DEFAULT_SCREENS;
}

// --- Backward-compat export ---

export const DEFAULT_SCREEN_SAFE_ZONES: ScreenSafeZones = {
  landscape: computeZones(DEFAULT_SCREENS, 'landscape'),
  portrait: computeZones(DEFAULT_SCREENS, 'portrait'),
};

// --- Hook ---

export function useScreenSafeZones() {
  // Same identity while the stored string is unchanged, so the memos below
  // only recompute on a real change.
  const screens = toScreens(useStoredString(STORAGE_KEY));

  const setScreens = useCallback((newScreens: ScreenZoneConfig[]) => {
    const config: ScreenSafeZonesConfig = { screens: newScreens };
    writeStored(STORAGE_KEY, JSON.stringify(config));
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
