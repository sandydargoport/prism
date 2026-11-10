'use client';

import { useStoredString, writeStored } from '@/lib/hooks/useStoredValue';

/**
 * Dim when idle (#691): at night the idle screen darkens, so a screen left on
 * all night is not a lamp in the room.
 *
 * Night is the dashboard's own rule (#1152), the one Today's veil and the
 * night backdrop go by, set in the editor's Through the day sheet. How dark is per screen: a bedroom may want more than the kitchen.
 *
 * A web page cannot turn the panel's backlight down or off; it can only draw
 * black over everything. On an OLED panel that is real dimming. On an LCD the
 * backlight stays on, but the room still gets less light.
 *
 * Applies to both idle screens, the separate screensaver and a calm dashboard.
 */

const LEVEL_KEY = 'prism-screensaver-dim';

/** How much darker, as the opacity of the black drawn over the screen. */
export const DIM_LEVELS: { raw: string; label: string }[] = [
  { raw: '0', label: 'Off' },
  { raw: '0.25', label: '25% darker' },
  { raw: '0.5', label: '50% darker' },
  { raw: '0.75', label: '75% darker' },
];

// Off unless the screen asks: a darker idle screen on update would read as a fault.
export const DEFAULT_DIM_LEVEL = '0';

/** The stored level as an opacity, 0 for nothing stored or anything unknown. */
export function dimLevel(raw: string | null): number {
  const known = DIM_LEVELS.find((l) => l.raw === raw);
  return Number(known?.raw ?? DEFAULT_DIM_LEVEL);
}

/** How dark the idle screen is: the level at night, 0 by day. */
export function dimAt(levelRaw: string | null, night: boolean): number {
  return night ? dimLevel(levelRaw) : 0;
}

const setLevel = (raw: string) => writeStored(LEVEL_KEY, raw);

export function useIdleDimSetting() {
  const raw = useStoredString(LEVEL_KEY);
  return {
    level: DIM_LEVELS.some((l) => l.raw === raw) ? raw! : DEFAULT_DIM_LEVEL,
    setLevel,
  };
}

/**
 * The black layer itself, over everything and never in the way of a tap.
 *
 * It eases in slowly, so the room notices the screen settling rather than a
 * switch, and lifts quickly on a touch. The screensaver says when it is
 * night, rechecked each minute, so a screen already idle at dusk dims then.
 */
export function IdleDim({ idle, night }: { idle: boolean; night: boolean }) {
  const { level } = useIdleDimSetting();
  const opacity = idle ? dimAt(level, night) : 0;
  return (
    <div
      aria-hidden
      data-idle-dim
      className="pointer-events-none fixed inset-0 z-10000 bg-black"
      style={{
        opacity,
        transition: `opacity ${opacity > 0 ? 4 : 0.4}s ease`,
      }}
    />
  );
}
