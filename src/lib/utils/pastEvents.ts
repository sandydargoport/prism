import { isCalendarEventPast } from './timeFormat';

/**
 * How the calendar treats events that have already ended.
 *
 * - `show`: the calendar as it was before this setting existed, and the
 *   default, so an upgrade changes nothing. The list and grid views already
 *   dim ended events; the agenda shows them at full strength.
 * - `dim`: the agenda dims them too, so every view agrees.
 * - `hide`: removed from the agenda and list views, which read as "what is
 *   next" on a wall display. Grid views (day, week, multi-week, month) keep
 *   dimming instead: an empty past day in a grid looks like a sync failure.
 */
export type PastEventsMode = 'show' | 'dim' | 'hide';

/** Database settings key (household-wide, shared across displays). */
export const PAST_EVENTS_SETTING_KEY = 'calendarPastEvents';

export const DEFAULT_PAST_EVENTS_MODE: PastEventsMode = 'show';

export function isPastEventsMode(value: unknown): value is PastEventsMode {
  return value === 'show' || value === 'dim' || value === 'hide';
}

type EventTimes = { startTime: Date; endTime: Date; allDay: boolean };

/**
 * The events that have not ended yet. An event still in progress stays, and an
 * all-day event stays until its last day is over in the display timezone (see
 * isCalendarEventPast for how all-day ends are read).
 */
export function withoutEndedEvents<T extends EventTimes>(
  events: T[],
  now: Date,
  timeZone?: string,
): T[] {
  return events.filter(
    (event) => !isCalendarEventPast(event.startTime, event.endTime, event.allDay, now, timeZone),
  );
}
