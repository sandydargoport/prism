'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { addDays, startOfDay } from 'date-fns';
import type { CalendarEvent } from '@/types/calendar';
import { useCalendarEvents } from '@/lib/hooks/useCalendarEvents';
import { useHiddenHours, visibleHours, type HiddenHoursSettings } from '@/lib/hooks/useHiddenHours';
import { useLocalDateKey } from '@/lib/hooks/useLocalDateKey';
import { useStoredString, writeStored } from '@/lib/hooks/useStoredValue';

/**
 * Dim when idle (#691): the idle screen darkens during the hours the calendar
 * hides, so a screen left on all night is not a lamp in the room.
 *
 * The hours are not a setting of their own. Settings > Calendars > Calendar
 * Hours already says when the household is not up, either a fixed range or
 * auto-fit around the day's events, so one change there moves both. How dark
 * is per screen: a bedroom may want more than the kitchen.
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

/** Today on the screen's own clock, as the calendar's day view reads it. */
function dayOf(at: Date): { from: Date; to: Date } {
  const from = startOfDay(at);
  return { from, to: addDays(from, 1) };
}

/**
 * How dark the idle screen is at `at`: the level during the hours the calendar
 * hides, 0 otherwise. Follows the hidden range whether or not the calendar's
 * own clock button is showing it, since that button is about the view.
 */
export function dimAt(
  levelRaw: string | null,
  hours: HiddenHoursSettings,
  events: CalendarEvent[],
  at: Date,
): number {
  const shown = visibleHours({ ...hours, enabled: true }, events, dayOf(at));
  return shown.includes(at.getHours()) ? 0 : dimLevel(levelRaw);
}

/** When the screen dims, as words for Settings. */
export function describeDimHours(hours: HiddenHoursSettings): string {
  if (hours.mode === 'auto-fit') {
    const buffer = `${hours.bufferHours} hour${hours.bufferHours === 1 ? '' : 's'}`;
    return `before the day's first timed event and after its last, with ${buffer} either side (outside 8 am to 7 pm on a day without any)`;
  }
  const hour = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'am' : 'pm'}`;
  return `from ${hour(hours.startHour)} to ${hour(hours.endHour)}`;
}

const setLevel = (raw: string) => writeStored(LEVEL_KEY, raw);

export function useIdleDimSetting() {
  const raw = useStoredString(LEVEL_KEY);
  return {
    level: DIM_LEVELS.some((l) => l.raw === raw) ? raw! : DEFAULT_DIM_LEVEL,
    setLevel,
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
 * half minute, so a screen already idle when the hours begin dims then.
 */
export function IdleDim({ idle }: { idle: boolean }) {
  const { level } = useIdleDimSetting();
  const dims = dimLevel(level) > 0;
  const { settings: hours } = useHiddenHours();
  // Today's events, fetched only when auto-fit needs them. The key changes
  // at local midnight, which is what moves the window on.
  const dateKey = useLocalDateKey();
  const today = useMemo(() => dayOf(new Date()), [dateKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const { events } = useCalendarEvents({
    rangeStart: today.from,
    rangeEnd: today.to,
    useDemoFallback: false,
    autoSyncMinutes: 0,
    enabled: dims && hours.mode === 'auto-fit',
  });

  const on = idle && dims;
  // Only keeps time while it could be dark; read fresh on going idle.
  const minute = useSyncExternalStore(on ? subscribeMinute : noSubscribe, currentMinute, () => 0);

  const opacity = on ? dimAt(level, hours, events, new Date(minute * 60_000)) : 0;
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
