'use client';

import { levelFromDim, type NightLevel } from '@/lib/screenDay';
import { useScreenDay } from './useScreenDay';

/**
 * Dim when idle (#691): at night the idle screen darkens, so a screen left on
 * all night is not a lamp in the room.
 *
 * Night, and how much darker, are the screen's own (#1345), kept in its day
 * (lib/screenDay): a bedroom may want more than the kitchen, and a switch to
 * another dashboard changes neither.
 *
 * A web page cannot turn the panel's backlight down or off; it can only draw
 * black over everything. On an OLED panel that is real dimming. On an LCD the
 * backlight stays on, but the room still gets less light.
 *
 * Applies to both idle screens, the separate screensaver and a calm dashboard.
 */

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

/** A level in percent as the raw value the choices use. */
export function rawOfLevel(level: NightLevel): string {
  return String(level / 100);
}

/**
 * How much darker this screen goes at night, as one of the raw choices, and
 * setting it, which writes the screen's day with the new level.
 */
export function useIdleDimSetting() {
  const { day, setDay } = useScreenDay();
  return {
    level: rawOfLevel(day.nightLevel),
    setLevel: (raw: string) => {
      const level = levelFromDim(raw);
      if (level !== null) setDay({ ...day, nightLevel: level });
    },
  };
}

/**
 * The black layer itself, over everything and never in the way of a tap.
 *
 * It eases in slowly, so the room notices the screen settling rather than a
 * switch, and lifts quickly on a touch. How dark comes from the screen's
 * scene (`screenStateAt`, #1344), rechecked each minute, so a screen already
 * idle at dusk dims then.
 */
export function IdleDim({ opacity }: { opacity: number }) {
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
