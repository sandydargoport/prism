/**
 * Where the solid line of a trip starts.
 *
 * A trip that starts at the school (the afternoon run) has the bus driving to
 * the school first, which is not part of the trip. So its line starts where
 * the bus last stood waiting at the school, and before the bus gets there it
 * is drawn as a marker only. Any other trip draws every fix.
 */

import { metresBetween } from './busTween';

/**
 * A bus at the school can park well away from the stop's point: on a campus
 * the bus loop is often a couple of hundred metres from it.
 */
export const AT_SCHOOL_M = 200;
/** Fixes closer together than this are the bus standing still, give or take GPS wander. */
const STILL_M = 25;

export type TraceFix = { ts: string; lat: number; lng: number };
export type TraceStop = { order: number; kind?: string | null; lat: number; lng: number; arrivedAt: string | null };

/**
 * The time the line starts from: -Infinity for the whole trip, Infinity for no
 * line yet. Fixes are oldest first.
 */
export function traceStartTs(fixes: TraceFix[], stops: TraceStop[]): number {
  const first = stops.reduce<TraceStop | null>((a, s) => (!a || s.order < a.order ? s : a), null);
  if (first?.kind !== 'school') return -Infinity;

  // The first visit only: the route can pass the school again later.
  const visit: TraceFix[] = [];
  for (const f of fixes) {
    if (metresBetween(f, first) <= AT_SCHOOL_M) visit.push(f);
    else if (visit.length > 0) break;
  }
  if (visit.length > 0) return new Date(waitEnd(visit).ts).getTime();
  // The provider saw it arrive though no fix came close: start from that arrival.
  if (first.arrivedAt) {
    const arrived = new Date(first.arrivedAt).getTime();
    const after = fixes.find((f) => new Date(f.ts).getTime() >= arrived);
    return after ? new Date(after.ts).getTime() : Infinity;
  }
  return Infinity;
}

/**
 * The last fix of the longest stretch the bus stood still, which is the wait
 * in the bus loop rather than a pause at the gate on the way out. With no
 * stretch at all (it drove straight through), the last fix of the visit.
 */
function waitEnd(visit: TraceFix[]): TraceFix {
  const ms = (f: TraceFix) => new Date(f.ts).getTime();
  let best: { from: TraceFix; to: TraceFix } | null = null;
  let from = visit[0]!;
  for (let i = 1; i < visit.length; i++) {
    if (metresBetween(visit[i - 1]!, visit[i]!) > STILL_M) { from = visit[i]!; continue; }
    if (!best || ms(visit[i]!) - ms(from) > ms(best.to) - ms(best.from)) best = { from, to: visit[i]! };
  }
  return best?.to ?? visit[visit.length - 1]!;
}

/** The solid line as [lng, lat]: from where the trip starts (above) to `untilTs`. */
export function traceCoordinates(fixes: TraceFix[], stops: TraceStop[], untilTs: number): [number, number][] {
  const from = traceStartTs(fixes, stops);
  return fixes
    .filter((f) => { const ts = new Date(f.ts).getTime(); return ts >= from && ts <= untilTs; })
    .map((f) => [f.lng, f.lat]);
}
