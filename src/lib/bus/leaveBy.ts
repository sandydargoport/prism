/**
 * When to leave for the bus (#900): the bus's arrival at the stop minus the
 * walk there. Amber in the last five minutes, "Leave now" at the moment, and
 * nothing once it has passed (the bus line then stands alone).
 */
export const LEAVE_SOON_MINUTES = 5;

export type LeaveBy =
  | { state: 'later' | 'soon'; minutes: number; at: Date }
  | { state: 'now'; minutes: 0; at: Date };

export function leaveBy(opts: { arrival: Date | null; walkMinutes: number | null | undefined; now: Date }): LeaveBy | null {
  const walk = opts.walkMinutes ?? 0;
  if (!opts.arrival || !(walk > 0)) return null;
  const at = new Date(opts.arrival.getTime() - walk * 60_000);
  const minutes = Math.ceil((at.getTime() - opts.now.getTime()) / 60_000);
  // A minute's grace for "Leave now", then the line gives way.
  if (minutes < 0) return null;
  if (minutes === 0) return { state: 'now', minutes: 0, at };
  return { state: minutes <= LEAVE_SOON_MINUTES ? 'soon' : 'later', minutes, at };
}

/**
 * The arrival to count back from: the live prediction when there is one,
 * else today's scheduled time at the stop (HH:mm, in the household zone).
 */
export function busArrival(opts: {
  etaMinutes: number | null;
  scheduled: Date | null;
  now: Date;
}): Date | null {
  if (opts.etaMinutes !== null && opts.etaMinutes >= 0) return new Date(opts.now.getTime() + opts.etaMinutes * 60_000);
  return opts.scheduled;
}
