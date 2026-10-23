/**
 * The long-lived record of each trip, kept after its trace is deleted.
 *
 * Once a day is over, every trip the provider reported for a bound route is
 * summarised into one bus_trips row: did it run, how many stops it reached,
 * how many it passed without opening the doors, when it started and finished,
 * which vehicle, a keyed hash of the driver, and the weather. That is what the
 * prediction learns from later.
 *
 * Days with no bus never get a row, and a trip that was reported but did not
 * run is marked `none`, never recorded as a trip that took no time. Only trips
 * that ran may feed typical times: a holiday must not pull an average to zero.
 */

import { createHmac } from 'crypto';
import { and, asc, eq, inArray, isNotNull, isNull, lt } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  busStopVisits, busTrips, vehicleFixes, vehicleTracks, type LiveTrackStop,
} from '@/lib/db/schema';
import { getHouseholdTimezone } from '@/lib/householdTimezone';
import { todayKey, weekdayOfKey } from '@/lib/utils/zonedDate';
import { metresBetween } from '@/lib/map/busTween';
import { checkFixes } from '@/lib/map/busFixCheck';
import { visitedOfOurStops } from '@/lib/services/bus-eta';

/** At this speed or more a fix counts as moving, for a provider that sends no flag. */
export const MOVING_MPS = 2;
/** A door opening further than this from a stop was not for that stop (a railway crossing). */
export const DOOR_NEAR_STOP_M = 60;

export type TripOutcome = 'ran' | 'partial' | 'none';

export interface TripFacts {
  stops: LiveTrackStop[];
  visits: { stopKey: string; arrivedAt: Date | null }[];
  progress: { lastVisitedStop: number; totalStops: number } | null;
  fixes: { ts: Date; lat: number; lng: number; doorOpen: boolean | null }[];
  firstMove: Date | null;
}

export interface TripSummary {
  outcome: TripOutcome;
  stopsVisited: number;
  totalStops: number;
  stopsSkipped: number | null;
  startedAt: Date | null;
  finishedAt: Date | null;
}

/**
 * What happened on one trip. `ran` means it reached its last stop, `partial`
 * that it reached some (a feed that dropped out, a trip cut short), and `none`
 * that it reached no stop at all.
 */
export function summarizeTrip(f: TripFacts): TripSummary {
  const ordered = [...f.stops].sort((a, b) => a.order - b.order);
  const totalStops = ordered.length || f.progress?.totalStops || 0;
  const arrived = f.visits.filter((v) => v.arrivedAt);
  const reached = new Set(arrived.map((v) => v.stopKey));
  const stopsVisited = Math.max(reached.size, visitedOfOurStops(f.progress, totalStops));

  const last = ordered[ordered.length - 1];
  const reachedEnd = (last && reached.has(last.key)) || (totalStops > 0 && stopsVisited >= totalStops);
  const outcome: TripOutcome = stopsVisited === 0 ? 'none' : reachedEnd ? 'ran' : 'partial';

  // A stop counts as skipped when the bus reached it and no door opened near
  // it. Without any door state from the provider, it is unknown, not zero.
  let stopsSkipped: number | null = null;
  if (f.fixes.some((x) => x.doorOpen !== null)) {
    const opened = f.fixes.filter((x) => x.doorOpen);
    stopsSkipped = ordered
      .filter((s) => (s.kind ?? 'stop') === 'stop' && reached.has(s.key))
      .filter((s) => !opened.some((x) => metresBetween(x, s) <= DOOR_NEAR_STOP_M))
      .length;
  }

  const times = arrived.map((v) => v.arrivedAt!.getTime());
  return {
    outcome,
    stopsVisited,
    totalStops,
    stopsSkipped,
    startedAt: f.firstMove ?? (times.length ? new Date(Math.min(...times)) : null),
    finishedAt: times.length ? new Date(Math.max(...times)) : null,
  };
}

/** Today's weather in the three buckets a trip is compared in. Null when unknown. */
export function weatherBucket(condition: unknown): 'dry' | 'rain' | 'snow' | null {
  if (typeof condition !== 'string' || condition === '') return null;
  if (condition === 'snowy') return 'snow';
  if (condition === 'rainy' || condition === 'stormy') return 'rain';
  return 'dry';
}

/**
 * The driver as a keyed hash, so a year of history can tell drivers apart
 * without keeping anyone's name. Null without a server secret to key it.
 */
export function driverKey(name: string | null | undefined, secret = process.env.SESSION_SECRET): string | null {
  const clean = name?.trim().toLowerCase();
  if (!clean || !secret) return null;
  return createHmac('sha256', secret).update(`bus-driver:${clean}`).digest('hex').slice(0, 16);
}

/**
 * When each track's bus first moved: the start of the trip proper. Read from
 * checked fixes, so a provider's broken speed or motion flag cannot start a
 * trip early; with no usable speed it falls back to what the positions show.
 */
export async function firstMoves(trackIds: string[]): Promise<Map<string, Date>> {
  if (trackIds.length === 0) return new Map();
  const rows = await db
    .select({
      trackId: vehicleFixes.trackId, ts: vehicleFixes.ts, lat: vehicleFixes.lat, lng: vehicleFixes.lng,
      speed: vehicleFixes.speed, moving: vehicleFixes.moving, doorOpen: vehicleFixes.doorOpen,
    })
    .from(vehicleFixes)
    .where(inArray(vehicleFixes.trackId, trackIds))
    .orderBy(asc(vehicleFixes.ts));
  const byTrack = new Map<string, typeof rows>();
  for (const r of rows) byTrack.set(r.trackId, [...(byTrack.get(r.trackId) ?? []), r]);
  const moved = new Map<string, Date>();
  for (const [trackId, fixes] of byTrack) {
    const first = checkFixes(fixes).find((f) => (f.speed ?? 0) >= MOVING_MPS || (f.speed === null && f.moving === true));
    if (first) moved.set(trackId, first.ts);
  }
  return moved;
}

/**
 * Summarises every finished day's trip that has no bus_trips row yet. Runs
 * before the trace retention sweep, so a trip is summarised long before its
 * trace is deleted. Returns how many rows were written.
 */
export async function summarizeFinishedTrips(now: Date = new Date()): Promise<number> {
  const today = todayKey(await getHouseholdTimezone(), now);
  const pending = await db
    .select({ track: vehicleTracks })
    .from(vehicleTracks)
    .leftJoin(busTrips, and(
      eq(busTrips.routeId, vehicleTracks.routeId),
      eq(busTrips.tripDate, vehicleTracks.tripDate),
    ))
    .where(and(
      isNotNull(vehicleTracks.routeId),
      lt(vehicleTracks.tripDate, today),
      isNull(busTrips.id),
    ))
    // If a provider re-keyed a route's trip mid-day, the first track recorded wins.
    .orderBy(asc(vehicleTracks.tripDate), asc(vehicleTracks.createdAt));
  if (pending.length === 0) return 0;

  const ids = pending.map((p) => p.track.id);
  const moved = await firstMoves(ids);
  let written = 0;
  for (const { track } of pending) {
    const [visits, fixes] = await Promise.all([
      db.select({ stopKey: busStopVisits.stopKey, arrivedAt: busStopVisits.arrivedAt })
        .from(busStopVisits)
        .where(and(eq(busStopVisits.routeId, track.routeId!), eq(busStopVisits.tripDate, track.tripDate))),
      db.select({
        ts: vehicleFixes.ts, lat: vehicleFixes.lat, lng: vehicleFixes.lng,
        speed: vehicleFixes.speed, moving: vehicleFixes.moving, doorOpen: vehicleFixes.doorOpen,
      })
        .from(vehicleFixes)
        .where(eq(vehicleFixes.trackId, track.id))
        .orderBy(asc(vehicleFixes.ts)),
    ]);
    const summary = summarizeTrip({
      stops: track.stops,
      visits,
      progress: track.progress ?? null,
      fixes: checkFixes(fixes),
      firstMove: moved.get(track.id) ?? null,
    });
    const weather = track.weather as { condition?: unknown; temperatureC?: unknown } | null;
    const inserted = await db.insert(busTrips).values({
      routeId: track.routeId!,
      tripDate: track.tripDate,
      dayOfWeek: weekdayOfKey(track.tripDate),
      direction: track.direction,
      ...summary,
      vehicleKey: track.vehicle?.number ?? null,
      driverKey: driverKey(track.vehicle?.driverName),
      weather: weatherBucket(weather?.condition),
      temperatureC: typeof weather?.temperatureC === 'number' ? weather.temperatureC : null,
    }).onConflictDoNothing().returning({ id: busTrips.id });
    written += inserted.length;
  }
  return written;
}
