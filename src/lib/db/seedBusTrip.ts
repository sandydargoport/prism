/**
 * Today's afternoon bus trip for the demo seed, as the provider would have
 * logged it: leaving school at 3:18 PM and reaching the stop at 3:31 PM.
 *
 * A seed run in the afternoon had no trip for today, so the afternoon route
 * read "Overdue, no updates", a broken-looking card on the dashboard and in
 * the screenshots. Nothing is logged before the trip has ended or on a
 * weekend, so a morning seed (the visual tests run at 09:30) is unchanged.
 */

export type SeedTripEvent = {
  eventType: 'distance_based' | 'arrived_at_stop';
  checkpointName: string;
  checkpointIndex: number;
  eventTime: Date;
  dayOfWeek: number;
  tripDate: string;
  gmailMessageId: string;
};

/** Checkpoints in order, at local time [hour, minute]; the last is the stop. */
const TRIP: Array<[name: string, hour: number, minute: number]> = [
  ['School', 15, 18],
  ['Pine Grove', 15, 23],
  ['Maple & 3rd', 15, 27],
  ['Our stop', 15, 31],
];

/** `now` and the event times use the local clock, as the rest of the seed does. */
export function afternoonTripEvents(now: Date): SeedTripEvent[] {
  const dayOfWeek = now.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return [];
  const at = (hour: number, minute: number) => {
    const d = new Date(now);
    d.setHours(hour, minute, 0, 0);
    return d;
  };
  const [, endHour, endMinute] = TRIP[TRIP.length - 1]!;
  if (now < at(endHour, endMinute)) return [];

  const pad = (n: number) => String(n).padStart(2, '0');
  const tripDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return TRIP.map(([checkpointName, hour, minute], checkpointIndex) => ({
    eventType: checkpointIndex === TRIP.length - 1 ? 'arrived_at_stop' : 'distance_based',
    checkpointName,
    checkpointIndex,
    eventTime: at(hour, minute),
    dayOfWeek,
    tripDate,
    gmailMessageId: `seed-pm-${tripDate}-${checkpointIndex}`,
  }));
}
