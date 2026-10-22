/**
 * Measuring the arrival projection against what happened.
 *
 * While a trip runs, the projected arrival at the household's stop is saved
 * once at each lead time in HORIZONS_MIN. After the bus arrives, the error at
 * each lead time is the actual arrival (from bus_stop_visits) minus what was
 * projected. Snapshots are written from ingest, so a day with no bus writes
 * none; a snapshot whose trip never reached the stop has no actual and is
 * left unscored, never counted as a miss of zero.
 */

import { and, eq, gte, inArray, isNotNull } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { busEtaSnapshots, busRoutes, busStopVisits, vehicleTracks } from '@/lib/db/schema';
import { getHouseholdTimezone } from '@/lib/householdTimezone';
import { addDaysToKey, todayKey } from '@/lib/utils/zonedDate';
import { pickRiderStop, projectStops } from './bus-eta';
import { firstMoves } from './bus-history';

/** Lead times, in minutes before the projected arrival, at which a snapshot is saved. */
export const HORIZONS_MIN = [20, 15, 10, 5, 2] as const;
/** A lead time is due in the minute before it, so a late-starting feed does not fill in the ones it missed. */
const DUE_WINDOW_MS = 60_000;
/** The projection that made the snapshot; history-based ones get their own name later. */
export const MODEL_PLANNED = 'planned';

/** Lead times due with `remainingMs` to go: those whose minute this falls in. */
export function dueHorizons(remainingMs: number): number[] {
  return HORIZONS_MIN.filter((h) => remainingMs <= h * 60_000 && remainingMs > h * 60_000 - DUE_WINDOW_MS);
}

/**
 * Saves any due snapshots for the given tracks. Called after each ingest;
 * the unique index makes a repeat a no-op, so several payloads in the same
 * minute write one row.
 */
export async function recordEtaSnapshots(trackIds: string[], now: Date = new Date()): Promise<number> {
  if (trackIds.length === 0) return 0;
  const today = todayKey(await getHouseholdTimezone(), now);
  const rows = await db
    .select({ track: vehicleTracks, stopName: busRoutes.stopName })
    .from(vehicleTracks)
    .innerJoin(busRoutes, eq(vehicleTracks.routeId, busRoutes.id))
    .where(and(inArray(vehicleTracks.id, trackIds), eq(vehicleTracks.tripDate, today)));
  if (rows.length === 0) return 0;

  const ids = rows.map((r) => r.track.id);
  const [visits, moved] = await Promise.all([
    db.select().from(busStopVisits).where(inArray(busStopVisits.trackId, ids)),
    firstMoves(ids),
  ]);

  let written = 0;
  for (const { track, stopName } of rows) {
    const riderKey = pickRiderStop(track.stops, stopName);
    if (!riderKey) continue;
    const projection = projectStops(
      track.stops,
      visits.filter((v) => v.trackId === track.id),
      track.progress,
      now,
      { plannedStart: track.plannedStart, departedAt: moved.get(track.id) ?? null },
    );
    const rider = projection.stops.find((s) => s.key === riderKey);
    if (!rider || rider.passed || !rider.projectedAt) continue;
    const due = dueHorizons(new Date(rider.projectedAt).getTime() - now.getTime());
    if (due.length === 0) continue;
    const inserted = await db.insert(busEtaSnapshots)
      .values(due.map((h) => ({
        routeId: track.routeId!,
        tripDate: track.tripDate,
        stopKey: riderKey,
        horizonMin: h,
        madeAt: now,
        predictedAt: new Date(rider.projectedAt!),
        model: MODEL_PLANNED,
      })))
      .onConflictDoNothing()
      .returning({ id: busEtaSnapshots.id });
    written += inserted.length;
  }
  return written;
}

export interface HorizonAccuracy {
  horizonMin: number;
  /** Trips scored: snapshots whose bus then reached the stop. */
  trips: number;
  /** Typical miss either way, minutes (median of the absolute error). */
  typicalMin: number | null;
  /** Four trips in five land within this many minutes. */
  within80Min: number | null;
  /** Median of actual minus projected: positive, the bus came later than shown. */
  biasMin: number | null;
}

function quantile(sorted: number[], q: number): number {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (i - lo);
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Accuracy at each lead time, from snapshot and actual pairs. Unscored rows (no actual) are skipped. */
export function accuracyByHorizon(
  rows: { horizonMin: number; predictedAt: Date; actualAt: Date | null }[],
): HorizonAccuracy[] {
  return HORIZONS_MIN.map((h) => {
    const errors = rows
      .filter((r) => r.horizonMin === h && r.actualAt)
      .map((r) => (r.actualAt!.getTime() - r.predictedAt.getTime()) / 60_000);
    if (errors.length === 0) return { horizonMin: h, trips: 0, typicalMin: null, within80Min: null, biasMin: null };
    const abs = errors.map(Math.abs).sort((a, b) => a - b);
    const signed = [...errors].sort((a, b) => a - b);
    return {
      horizonMin: h,
      trips: errors.length,
      typicalMin: round1(quantile(abs, 0.5)),
      within80Min: round1(quantile(abs, 0.8)),
      biasMin: round1(quantile(signed, 0.5)),
    };
  });
}

/** Snapshots from the last `days` days with the actual arrival at their stop, per route. */
export async function loadAccuracy(days = 90, now: Date = new Date()) {
  const since = addDaysToKey(todayKey(await getHouseholdTimezone(), now), -days);
  const rows = await db
    .select({
      routeId: busEtaSnapshots.routeId,
      horizonMin: busEtaSnapshots.horizonMin,
      predictedAt: busEtaSnapshots.predictedAt,
      actualAt: busStopVisits.arrivedAt,
    })
    .from(busEtaSnapshots)
    .leftJoin(busStopVisits, and(
      eq(busStopVisits.routeId, busEtaSnapshots.routeId),
      eq(busStopVisits.tripDate, busEtaSnapshots.tripDate),
      eq(busStopVisits.stopKey, busEtaSnapshots.stopKey),
      isNotNull(busStopVisits.arrivedAt),
    ))
    .where(gte(busEtaSnapshots.tripDate, since));
  const byRoute = new Map<string, typeof rows>();
  for (const r of rows) (byRoute.get(r.routeId) ?? byRoute.set(r.routeId, []).get(r.routeId)!).push(r);
  return [...byRoute].map(([routeId, list]) => ({ routeId, horizons: accuracyByHorizon(list) }));
}
