'use client';

import { useSyncExternalStore } from 'react';
import { useStoredString, writeStored } from '@/lib/hooks/useStoredValue';

/**
 * Dim when idle (#691): the idle screen darkens during the hours chosen, so a
 * screen left on all night is not a lamp in the room.
 *
 * A web page cannot turn the panel's backlight down or off; it can only draw
 * black over everything. On an OLED panel that is real dimming. On an LCD the
 * backlight stays on, but the room still gets less light.
 *
 * Applies to both idle screens, the separate screensaver and a calm dashboard,
 * and is per screen: the kitchen and a bedroom want different nights.
 */

const LEVEL_KEY = 'prism-screensaver-dim';
const HOURS_KEY = 'prism-screensaver-dim-hours';

/** How dark, as the opacity of the black drawn over the screen. */
export const DIM_LEVELS: { raw: string; label: string }[] = [
  { raw: '0', label: 'Off' },
  { raw: '0.3', label: 'A little' },
  { raw: '0.5', label: 'Half' },
  { raw: '0.7', label: 'A lot' },
];

/** When, as start-end in whole hours on the screen's own clock, or all day. */
export const DIM_HOURS: { raw: string; label: string }[] = [
  { raw: '20-7', label: '8 pm to 7 am' },
  { raw: '21-7', label: '9 pm to 7 am' },
  { raw: '22-6', label: '10 pm to 6 am' },
  { raw: '22-7', label: '10 pm to 7 am' },
  { raw: '23-7', label: '11 pm to 7 am' },
  { raw: 'always', label: 'All day' },
];

// Off unless the screen asks: a darker idle screen on update would read as a fault.
export const DEFAULT_DIM_LEVEL = '0';
export const DEFAULT_DIM_HOURS = '22-7';

/** The stored level as an opacity, 0 for nothing stored or anything unknown. */
export function dimLevel(raw: string | null): number {
  const known = DIM_LEVELS.find((l) => l.raw === raw);
  return Number(known?.raw ?? DEFAULT_DIM_LEVEL);
}

/** Whether `at` falls inside the stored hours, read on the screen's own clock. */
export function inDimHours(raw: string | null, at: Date): boolean {
  const hours = DIM_HOURS.some((h) => h.raw === raw) ? raw! : DEFAULT_DIM_HOURS;
  if (hours === 'always') return true;
  const [start, end] = hours.split('-').map(Number) as [number, number];
  const h = at.getHours();
  // A window that runs past midnight wraps round it.
  return start <= end ? h >= start && h < end : h >= start || h < end;
}

/** How dark the idle screen is at `at`: 0 outside the hours or when off. */
export function dimAt(levelRaw: string | null, hoursRaw: string | null, at: Date): number {
  return inDimHours(hoursRaw, at) ? dimLevel(levelRaw) : 0;
}

const setLevel = (raw: string) => writeStored(LEVEL_KEY, raw);
const setHours = (raw: string) => writeStored(HOURS_KEY, raw);

export function useIdleDimSetting() {
  const levelRaw = useStoredString(LEVEL_KEY);
  const hoursRaw = useStoredString(HOURS_KEY);
  return {
    level: DIM_LEVELS.some((l) => l.raw === levelRaw) ? levelRaw! : DEFAULT_DIM_LEVEL,
    hours: DIM_HOURS.some((h) => h.raw === hoursRaw) ? hoursRaw! : DEFAULT_DIM_HOURS,
    setLevel,
    setHours,
  };
}

/** Re-checked every half minute, so the hours start and end on time. */
function subscribeMinute(onChange: () => void): () => void {
  const timer = setInterval(onChange, 30_000);
  return () => clearInterval(timer);
}
const currentMinute = () => Math.floor(Date.now() / 60_000);
const noSubscribe = () => () => {};

/**
 * The black layer itself, over everything and never in the way of a tap.
 *
 * It eases in slowly, so the room notices the screen settling rather than a
 * switch, and lifts quickly on a touch. While idle it checks the time each
 * half minute, so a screen already idle at the start of the hours dims then.
 */
export function IdleDim({ idle }: { idle: boolean }) {
  const { level, hours } = useIdleDimSetting();
  const on = idle && dimLevel(level) > 0;
  // Only keeps time while it could be dark; read fresh on going idle.
  const minute = useSyncExternalStore(on ? subscribeMinute : noSubscribe, currentMinute, () => 0);

  const opacity = on ? dimAt(level, hours, new Date(minute * 60_000)) : 0;
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
