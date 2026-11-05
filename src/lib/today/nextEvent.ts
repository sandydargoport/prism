/**
 * The one event the phone's Today header names (#928): the next timed event
 * still to start today, or the one under way; failing that, today's first
 * all-day event. Nothing when the day is clear.
 */
export interface NextEventLike {
  startTime: Date;
  endTime: Date;
  allDay: boolean;
}

export function nextEventToday<T extends NextEventLike>(
  events: T[],
  now: Date,
  isToday: (e: T) => boolean,
): T | undefined {
  const today = events.filter(isToday);
  const timed = today
    .filter((e) => !e.allDay && e.endTime.getTime() > now.getTime())
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  if (timed[0]) return timed[0];
  return today.find((e) => e.allDay);
}
