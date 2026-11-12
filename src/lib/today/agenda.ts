/**
 * Today as a list (#1030): what is next, what comes later today, and what is
 * already over. Today leads with this on the wall and the phone;
 * the arc is an option.
 */
export interface AgendaEventLike {
  id: string;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
}

export interface Agenda<T> {
  /** The event under way, or the next to start; failing that, an all-day one. */
  next: T | undefined;
  /** The rest still to come today, in start order. */
  later: T[];
  /** Today's timed events that have ended, most recent first. */
  done: T[];
}

export function todayAgenda<T extends AgendaEventLike>(events: T[], now: Date, isToday: (e: T) => boolean): Agenda<T> {
  const today = events.filter(isToday);
  const t = now.getTime();
  const timed = today.filter((e) => !e.allDay).sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  const allDay = today.filter((e) => e.allDay);
  const open = timed.filter((e) => e.endTime.getTime() > t);
  const done = timed.filter((e) => e.endTime.getTime() <= t).reverse();
  const next = open[0] ?? allDay[0];
  const later = [...open.slice(next && !next.allDay ? 1 : 0), ...allDay.filter((e) => e !== next)];
  return { next, later, done };
}
