/**
 * Projected arrival times for a live track's stops.
 *
 * This is the cold-start projection: the provider's planned stop times, moved
 * by how late or early the bus reached its most recent stop. It needs no
 * history, so it works on the first day. Learning from past trips comes later
 * and replaces the shift, not the shape of what this returns.
 *
 * Pure, so the widget endpoint and the tests share it.
 */

import type { LiveTrackStop } from '@/lib/db/schema';

export interface StopVisitTimes {
  stopKey: string;
  arrivedAt: Date | null;
  departedAt: Date | null;
}

export interface StopTiming {
  key: string;
  name: string | null;
  order: number;
  kind: LiveTrackStop['kind'] | null;
  lat: number;
  lng: number;
  plannedAt: string | null;
  arrivedAt: string | null;
  departedAt: string | null;
  /** Upcoming stops only; never earlier than now. */
  projectedAt: string | null;
  passed: boolean;
}

/** How the trip began: its planned start, and when the bus first moved. */
export interface TripStart {
  plannedStart: Date | null;
  departedAt: Date | null;
}

export interface Projection {
  stops: StopTiming[];
  /** How far behind plan the bus is running, in ms (negative = early). Null with nothing to go on. */
  shiftMs: number | null;
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/**
 * The household's stop: the one the provider marks as the rider's, else the
 * one named like the route's stop, else the last stop.
 */
export function pickRiderStop(stops: LiveTrackStop[], routeStopName?: string | null): string | null {
  if (stops.length === 0) return null;
  const flagged = stops.find((s) => s.rider);
  if (flagged) return flagged.key;
  const wanted = routeStopName?.trim().toLowerCase();
  if (wanted) {
    const named = stops.find((s) => s.name?.trim().toLowerCase() === wanted);
    if (named) return named.key;
  }
  return [...stops].sort((a, b) => a.order - b.order).at(-1)!.key;
}

/**
 * How many of OUR stops the provider's progress count says the bus has
 * visited. The count is over the provider's whole route, while a track holds
 * only the stops that matter here (FirstView: 22 on the route, 2 on the
 * track), so stop 2 of 22 is not our second stop. The two only line up when
 * the totals agree; otherwise the count says nothing about our stops.
 */
export function visitedOfOurStops(
  progress: { lastVisitedStop: number; totalStops: number } | null | undefined,
  stopCount: number,
): number {
  return progress && progress.totalStops === stopCount ? progress.lastVisitedStop : 0;
}

export function projectStops(
  stops: LiveTrackStop[],
  visits: StopVisitTimes[],
  progress: { lastVisitedStop: number; totalStops: number } | null | undefined,
  now: Date,
  start: TripStart | null = null,
): Projection {
  const ordered = [...stops].sort((a, b) => a.order - b.order);
  const byKey = new Map(visits.map((v) => [v.stopKey, v]));
  const visitedCount = visitedOfOurStops(progress, ordered.length);

  // A stop is passed once the bus reached it, or the provider's progress
  // count says so (it can run ahead of the arrival events).
  const passed = ordered.map((s, i) => Boolean(byKey.get(s.key)?.arrivedAt) || i < visitedCount);
  const lastPassed = passed.lastIndexOf(true);

  // Lateness at the most recent stop with both a plan and an arrival. Any
  // later stop the bus is known to have passed has no time, so it says nothing.
  let shiftMs: number | null = null;
  for (let i = lastPassed; i >= 0; i--) {
    const s = ordered[i]!;
    const arrived = byKey.get(s.key)?.arrivedAt;
    if (s.plannedAt && arrived) {
      shiftMs = arrived.getTime() - new Date(s.plannedAt).getTime();
      break;
    }
  }

  // Before the first stop, the start says it: a bus that leaves the depot
  // late seldom makes the time up, so a late start shifts every stop at once.
  // Still parked past the planned start, it is at least that late already.
  if (shiftMs === null && lastPassed < 0 && start?.plannedStart) {
    const planned = start.plannedStart.getTime();
    if (start.departedAt) shiftMs = start.departedAt.getTime() - planned;
    else if (now.getTime() > planned) shiftMs = now.getTime() - planned;
  }

  // If the next stop is already overdue on that shift, the bus is later than
  // the last stop says: push the next stop to now and the rest with it.
  let shift = shiftMs ?? 0;
  const next = ordered.find((s, i) => !passed[i] && s.plannedAt);
  if (next) {
    const nextAt = new Date(next.plannedAt!).getTime() + shift;
    if (nextAt < now.getTime()) {
      shift = now.getTime() - new Date(next.plannedAt!).getTime();
      shiftMs = shift;
    }
  }

  return {
    shiftMs,
    stops: ordered.map((s, i) => {
      const visit = byKey.get(s.key);
      const projected = !passed[i] && s.plannedAt
        ? new Date(Math.max(now.getTime(), new Date(s.plannedAt).getTime() + shift))
        : null;
      return {
        key: s.key,
        name: s.name ?? null,
        order: s.order,
        kind: s.kind ?? null,
        lat: s.lat,
        lng: s.lng,
        plannedAt: s.plannedAt ?? null,
        arrivedAt: iso(visit?.arrivedAt),
        departedAt: iso(visit?.departedAt),
        projectedAt: iso(projected),
        passed: passed[i]!,
      };
    }),
  };
}
