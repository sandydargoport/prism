'use client';

import { useEffect } from 'react';
import { useHydrated, useStoredString, writeStored } from '@/lib/hooks/useStoredValue';

const KEY = 'prism-screensaver-motion';
const INTERVAL_KEY = 'prism-screensaver-motion-interval';
export const DEFAULT_MOTION_INTERVAL = 20;   // seconds between changes

export type ScreensaverMotion = 'off' | 'fade' | 'smoke' | 'liquid' | 'fireworks';

/**
 * Whether widgets drift: slow ambient movement, to stop a widget living on the
 * same pixels for years. On unless the display turned it off. Earlier versions
 * stored a style (breathe, ripple, figure8) or nothing; all of those read as on,
 * since there is one motion now.
 */
export function driftOn(raw: string | null): boolean {
  return raw !== 'off';
}

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
const DRIFT_KEY = 'prism-screensaver-drift';
const CARBONATION_KEY = 'prism-screensaver-carbonation';
const WOBBLE_KEY = 'prism-screensaver-wobble';
const SPEED_KEY = 'prism-screensaver-speed';
const WATER_CLEAR_KEY = 'prism-screensaver-water-clear';
export const DEFAULT_FLOOR = 2;
export const DEFAULT_CEILING = 0;   // 0 = no cap

// Module-level, so each keeps one identity for every caller. A write reaches
// every mounted copy of the hook (Settings and the screensaver are separate
// trees) through the shared store.
const onOff = (v: boolean) => (v ? 'on' : 'off');
function setMotion(v: ScreensaverMotion) {
  writeStored(KEY, v);
  writeStored(MIGRATED_KEY, '1');
}
const setMotionInterval = (v: number) => writeStored(INTERVAL_KEY, String(v));
const setFloor = (v: number) => writeStored(FLOOR_KEY, String(v));
const setCeiling = (v: number) => writeStored(CEILING_KEY, String(v));
const setOutlines = (v: boolean) => writeStored(OUTLINES_KEY, onOff(v));
const setShortcut = (v: boolean) => writeStored(SHORTCUT_KEY, onOff(v));
const setDrift = (v: boolean) => writeStored(DRIFT_KEY, onOff(v));
const setCarbonation = (v: boolean) => writeStored(CARBONATION_KEY, onOff(v));
const setWobble = (v: number) => writeStored(WOBBLE_KEY, String(v));
const setWaterClear = (v: boolean) => writeStored(WATER_CLEAR_KEY, onOff(v));
const setSpeed = (v: number) => writeStored(SPEED_KEY, String(v));

/** A stored number that passes `ok`, or the default. Nothing stored is the default. */
function num(raw: string | null, ok: (n: number) => boolean, fallback: number): number {
  if (raw === null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && ok(n) ? n : fallback;
}

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
  const migrated = useStoredString(MIGRATED_KEY) === '1';
  const rawMotion = useStoredString(KEY);
  const motion = normalise(rawMotion, migrated) ?? 'off';
  const interval = num(useStoredString(INTERVAL_KEY), (n) => n > 0, DEFAULT_MOTION_INTERVAL);
  const floor = num(useStoredString(FLOOR_KEY), (n) => n > 0, DEFAULT_FLOOR);
  const ceiling = num(useStoredString(CEILING_KEY), (n) => n >= 0, DEFAULT_CEILING);
  const outlines = useStoredString(OUTLINES_KEY) !== 'off';
  // Off by default. The screensaver is what a room looks like when nobody is
  // using it, and putting a control on it changes that for every display on
  // update — the same reason the effects themselves default to off.
  const shortcut = useStoredString(SHORTCUT_KEY) === 'on';
  // Both idle screens, the separate screensaver and a calm dashboard.
  const drift = driftOn(useStoredString(DRIFT_KEY));
  const carbonation = useStoredString(CARBONATION_KEY) !== 'off';
  const wobble = num(useStoredString(WOBBLE_KEY), (n) => n >= 0, 1);
  const speed = num(useStoredString(SPEED_KEY), (n) => n > 0, 1);
  const waterClear = useStoredString(WATER_CLEAR_KEY) === 'on';
  // Whether the values above are the display's own yet, or still the defaults.
  //
  // Worth telling apart, because "not read yet" and "off" are not the same
  // answer and they render differently: 'off' means show every widget, and the
  // screensaver would otherwise paint a full board for the frame before the
  // real setting arrived. See the note in ScreensaverGrid. Only false during
  // hydration: on a client-side mount the stored values are there at once.
  const ready = useHydrated();

  // Rewrite an old name once, so the stored value means what it says from
  // then on. The render above already shows the migrated effect.
  useEffect(() => {
    if (migrated || !rawMotion) return;
    const m = normalise(rawMotion, false);
    if (m) setMotion(m);
  }, [migrated, rawMotion]);

  return {
    motion, setMotion,
    interval, setInterval: setMotionInterval,
    floor, setFloor,
    ceiling, setCeiling,
    outlines, setOutlines,
    shortcut, setShortcut,
    drift, setDrift,
    carbonation, setCarbonation,
    wobble, setWobble,
    speed, setSpeed,
    waterClear, setWaterClear,
    ready,
  };
}
