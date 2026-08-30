import type { CalendarEvent } from '@/types/calendar';

export const NIGHT_SKY_IDLE_SECONDS = 15 * 60;
export const NIGHT_START_HOUR = 21;
export const NIGHT_END_HOUR = 6;
export const NIGHT_SKY_WINDOW_DAYS = 14;

export function isNightSkyNight(date: Date): boolean {
  const forced = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('nightSkyMode') : null;
  if (forced === 'night') return true;
  if (forced === 'day') return false;
  const hour = date.getHours();
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
}

export function moonPhase(date: Date): { age: number; illumination: number; waxing: boolean } {
  const synodicMonth = 29.530588853;
  const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14);
  const days = (date.getTime() - knownNewMoon) / 86400000;
  const age = ((days % synodicMonth) + synodicMonth) % synodicMonth;
  return {
    age,
    illumination: (1 - Math.cos((age / synodicMonth) * Math.PI * 2)) / 2,
    waxing: age < synodicMonth / 2,
  };
}

export function nightSkyEvents(events: CalendarEvent[], now: Date) {
  const end = new Date(now);
  end.setDate(end.getDate() + NIGHT_SKY_WINDOW_DAYS);
  return events
    .filter((event) => event.endTime >= now && event.startTime <= end)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

export function tomorrowEvents(events: CalendarEvent[], now: Date) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
  return events.filter((event) => event.startTime >= start && event.startTime < end)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

export function auroraPalette(count: number) {
  if (count >= 8) return ['#7c3aed', '#c026d3', '#4f46e5'] as const;
  if (count >= 4) return ['#0d9488', '#2563eb', '#6366f1'] as const;
  return ['#10b981', '#14b8a6', '#22c55e'] as const;
}
