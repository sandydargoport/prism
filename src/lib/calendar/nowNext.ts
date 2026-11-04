import type { CalendarEvent } from '@/types/calendar';
import { eventOccursOnDisplayDay, toDisplayDate } from '@/lib/utils/timeFormat';

/** Minutes before a start when the next line turns to a warning (#806). */
export const NEXT_WARN_MINUTES = 10;

export type NowNext = {
  /** Timed events in progress, earliest end first. */
  now: CalendarEvent[];
  /** Today's next timed event that has not started yet. */
  next: CalendarEvent | null;
  /** Whole minutes until `next` starts, rounded up so "in 0 min" never shows. */
  minutesToNext: number | null;
  /** True in the last NEXT_WARN_MINUTES before `next` starts. */
  warn: boolean;
  /** Today has no events at all, all-day included. */
  emptyDay: boolean;
};

/** An event with a time of day (not all-day) that is happening at `now`. */
export function isInProgress(event: CalendarEvent, now: Date): boolean {
  if (event.allDay) return false;
  return event.startTime.getTime() <= now.getTime() && now.getTime() < event.endTime.getTime();
}

/**
 * What is happening now and what is next today, in the household's zone.
 * All-day events are never "now" or "next": they are the day's backdrop, and a
 * strip that always said "Now: Grandma visiting" would say nothing.
 */
export function nowNext(events: CalendarEvent[], now: Date, timeZone: string): NowNext {
  const today = toDisplayDate(now, timeZone);
  const todays = events.filter((e) => eventOccursOnDisplayDay(e.startTime, e.endTime, e.allDay, today, timeZone));
  const timed = todays.filter((e) => !e.allDay);

  const inProgress = timed
    .filter((e) => isInProgress(e, now))
    .sort((a, b) => a.endTime.getTime() - b.endTime.getTime());

  const upcoming = timed
    .filter((e) => e.startTime.getTime() > now.getTime()
      && eventOccursOnDisplayDay(e.startTime, e.startTime, false, today, timeZone))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime() || a.title.localeCompare(b.title));

  const next = upcoming[0] ?? null;
  const minutesToNext = next ? Math.max(1, Math.ceil((next.startTime.getTime() - now.getTime()) / 60_000)) : null;

  return {
    now: inProgress,
    next,
    minutesToNext,
    warn: minutesToNext !== null && minutesToNext <= NEXT_WARN_MINUTES,
    emptyDay: todays.length === 0,
  };
}
