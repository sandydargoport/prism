import { addMonths, endOfMonth, startOfMonth, startOfQuarter, subMonths } from 'date-fns';

/**
 * Maximum events a single calendar fetch will return. Sized well above a busy
 * family's instance count across a {@link getCalendarWindow}, so the window
 * never silently truncates; the API logs a warning if a fetch ever hits it.
 */
export const MAX_CALENDAR_EVENTS = 5000;

/**
 * The date window the Calendar page fetches for the date it shows (#1082):
 * from the month before that date's quarter through six months after the
 * quarter starts, about eight months.
 *
 * It used to be a fixed four years (Jan 1 last year to Dec 31 two years on),
 * which a slow wall tablet had to parse and lay out on every visit (#1043).
 * This keeps what that bought:
 *   - Paging stays instant: every date in one quarter gives the same window,
 *     so moving within it reuses one request; and since a step moves at most a
 *     month, the window on screen already covers the next view while the next
 *     window loads.
 *   - Nothing past a horizon vanishes (#250): the window moves with the date
 *     shown, and always reaches past what any view draws (a month grid's lead
 *     week, the three-month view's last month and trailing week).
 */
export function getCalendarWindow(viewDate: Date): { start: Date; end: Date } {
  const quarter = startOfQuarter(viewDate);
  return { start: startOfMonth(subMonths(quarter, 1)), end: endOfMonth(addMonths(quarter, 6)) };
}

const DAY_MS = 86_400_000;

/**
 * Narrow a full (wide-window) event list to just those overlapping [from, to],
 * padded ±1 day so a timezone boundary can never drop a real match. Views fetch
 * one wide dataset (~thousands of events) but render a small window; scoping to
 * the visible range first turns their per-day O(days × all_events) filtering
 * into O(days × visible_events). The precise per-day membership check each view
 * already runs is unchanged, so results are identical.
 */
export function eventsOverlappingRange<T extends { startTime: Date; endTime: Date }>(
  events: T[],
  from: Date,
  to: Date,
): T[] {
  const start = from.getTime() - DAY_MS;
  const end = to.getTime() + 2 * DAY_MS;
  return events.filter((e) => e.startTime.getTime() <= end && e.endTime.getTime() >= start);
}
