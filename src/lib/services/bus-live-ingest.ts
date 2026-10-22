/**
 * Ingest for the live vehicle position contract (src/lib/validations/liveVehicle.ts).
 * Push (POST /api/bus-tracking/live/ingest) and any future poll transport both
 * end here, so a new provider never needs new core code.
 *
 * Nothing in this file knows a vendor. Keys are opaque and the provider label
 * is free-form; a route is tied to a provider's track by its `liveMatch`.
 */

import { and, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  busRoutes,
  busStopVisits,
  settings,
  vehicleFixes,
  vehicleTracks,
  type LiveTrackStop,
  type LiveTrackVehicle,
} from '@/lib/db/schema';
import { getHouseholdTimezone } from '@/lib/householdTimezone';
import { addDaysToKey, todayKey, weekdayOfKey } from '@/lib/utils/zonedDate';
import type { LiveTrackInput, LiveVehiclePayload } from '@/lib/validations/liveVehicle';
import { getTraceRetentionDays } from './bus-live-retention';
import { recordEtaSnapshots } from './bus-eta-snapshots';

/** A fix stamped further ahead than this is a clock fault, not a position. */
const MAX_FUTURE_MS = 5 * 60 * 1000;

export interface IngestResult {
  tracks: number;
  fixes: number;
  duplicateFixes: number;
  droppedFixes: number;
  stopEvents: number;
  unknownTracks: number;
  unboundStopEvents: number;
}

type TrackRow = typeof vehicleTracks.$inferSelect;
type RouteRow = typeof busRoutes.$inferSelect;

/**
 * The route a provider's track belongs to: same provider, and the label and
 * direction when the binding names them. The first enabled match wins.
 */
export function matchRoute(
  provider: string,
  track: { label?: string | null; direction?: string | null },
  routes: Pick<RouteRow, 'id' | 'enabled' | 'liveMatch'>[],
): string | null {
  for (const route of routes) {
    const m = route.liveMatch;
    if (!route.enabled || !m || m.provider !== provider) continue;
    if (m.label !== undefined && m.label !== track.label) continue;
    if (m.direction !== undefined && m.direction !== track.direction) continue;
    return route.id;
  }
  return null;
}

/**
 * The vehicle as stored: the latest report, flagged once the driver or the
 * vehicle changed during the day. Recording each day's report is what lets
 * the history answer "which bus and driver"; the flag is the only check.
 */
export function mergeVehicle(
  previous: LiveTrackVehicle | null | undefined,
  incoming: LiveTrackInput['vehicle'],
): LiveTrackVehicle | null {
  if (!incoming) return previous ?? null;
  const changed = Boolean(
    previous &&
      ((previous.driverName && incoming.driverName && previous.driverName !== incoming.driverName) ||
        (previous.number && incoming.number && previous.number !== incoming.number)),
  );
  return { ...incoming, changedMidDay: Boolean(previous?.changedMidDay) || changed };
}

async function upsertTracks(
  provider: string,
  tracks: LiveTrackInput[],
): Promise<void> {
  if (tracks.length === 0) return;
  const routes = await db.select().from(busRoutes);

  for (const t of tracks) {
    const [existing] = await db
      .select()
      .from(vehicleTracks)
      .where(and(
        eq(vehicleTracks.provider, provider),
        eq(vehicleTracks.externalKey, t.key),
        eq(vehicleTracks.tripDate, t.date),
      ))
      .limit(1);

    const values = {
      direction: t.direction ?? existing?.direction ?? null,
      label: t.label ?? existing?.label ?? null,
      stops: (t.stops as LiveTrackStop[] | undefined) ?? existing?.stops ?? [],
      plannedStart: t.plannedStart ? new Date(t.plannedStart) : existing?.plannedStart ?? null,
      plannedEnd: t.plannedEnd ? new Date(t.plannedEnd) : existing?.plannedEnd ?? null,
      status: t.status ?? existing?.status ?? null,
      vehicle: mergeVehicle(existing?.vehicle, t.vehicle),
    };
    // A track bound by hand keeps its route; an unbound one is matched again
    // in case the binding was added since it first arrived.
    const routeId = existing?.routeId ?? matchRoute(provider, values, routes);

    if (existing) {
      await db.update(vehicleTracks)
        .set({ ...values, routeId, updatedAt: new Date() })
        .where(eq(vehicleTracks.id, existing.id));
    } else {
      await db.insert(vehicleTracks)
        .values({ provider, externalKey: t.key, tripDate: t.date, routeId, ...values })
        .onConflictDoNothing();
    }
  }
}

/**
 * Today's and yesterday's tracks for the given keys, newest date first per
 * key. Yesterday covers a payload that straddles midnight.
 */
async function loadTracks(provider: string, keys: string[], timeZone: string, now: Date) {
  const byKey = new Map<string, TrackRow>();
  if (keys.length === 0) return byKey;
  const rows = await db
    .select()
    .from(vehicleTracks)
    .where(and(
      eq(vehicleTracks.provider, provider),
      inArray(vehicleTracks.externalKey, keys),
      gte(vehicleTracks.tripDate, addDaysToKey(todayKey(timeZone, now), -1)),
    ));
  for (const row of rows) {
    const seen = byKey.get(row.externalKey);
    if (!seen || row.tripDate > seen.tripDate) byKey.set(row.externalKey, row);
  }
  return byKey;
}

/**
 * Conditions at the household's saved location when a trip starts, for the
 * prediction to test against later. The household location, not the bus's
 * position, is what goes to the weather provider.
 */
async function snapshotWeather(trackId: string): Promise<void> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, 'location'));
    const loc = row?.value as { lat?: number; lon?: number } | undefined;
    if (loc?.lat === undefined || loc?.lon === undefined) return;
    const { fetchWeatherData } = await import('@/lib/integrations/weather');
    const weather = await fetchWeatherData(
      { lat: loc.lat, lon: loc.lon },
      { units: { temperature: 'C', windSpeed: 'km/h', precipitation: 'mm' } },
    );
    const c = weather.current;
    await db.update(vehicleTracks)
      .set({
        weather: {
          condition: c.condition,
          temperatureC: c.temperature,
          windKmh: c.windSpeed,
          at: new Date().toISOString(),
        },
      })
      .where(and(eq(vehicleTracks.id, trackId), isNull(vehicleTracks.weather)));
  } catch {
    // A missing snapshot only means one trip has no weather to learn from.
  }
}

export async function ingestLivePayload(
  payload: LiveVehiclePayload,
  now: Date = new Date(),
): Promise<IngestResult> {
  const result: IngestResult = {
    tracks: 0, fixes: 0, duplicateFixes: 0, droppedFixes: 0,
    stopEvents: 0, unknownTracks: 0, unboundStopEvents: 0,
  };
  const { provider } = payload;
  const timeZone = await getHouseholdTimezone();

  await upsertTracks(provider, payload.tracks ?? []);
  result.tracks = payload.tracks?.length ?? 0;

  const keys = new Set<string>();
  for (const f of payload.fixes ?? []) keys.add(f.track);
  for (const e of payload.stopEvents ?? []) keys.add(e.track);
  for (const p of payload.progress ?? []) keys.add(p.track);
  const tracks = await loadTracks(provider, [...keys], timeZone, now);
  const unknown = new Set<string>();

  // Fixes. Ordered by their own time, never by arrival, so late and
  // out-of-order fixes are simply stored.
  const oldest = now.getTime() - (await getTraceRetentionDays()) * 86_400_000;
  const newestByTrack = new Map<string, Date>();
  const rows: (typeof vehicleFixes.$inferInsert)[] = [];
  for (const f of payload.fixes ?? []) {
    const track = tracks.get(f.track);
    if (!track) { unknown.add(f.track); continue; }
    const ts = new Date(f.ts);
    if (ts.getTime() < oldest || ts.getTime() > now.getTime() + MAX_FUTURE_MS) {
      result.droppedFixes++;
      continue;
    }
    rows.push({
      trackId: track.id,
      ts,
      lat: f.lat,
      lng: f.lng,
      heading: f.heading ?? null,
      speed: f.speed ?? null,
      moving: f.moving ?? null,
      doorOpen: f.doorOpen ?? null,
      ignition: f.ignition ?? null,
      eventId: f.eventId ?? f.ts,
    });
    const newest = newestByTrack.get(track.id);
    if (!newest || ts > newest) newestByTrack.set(track.id, ts);
  }
  if (rows.length > 0) {
    const inserted = await db.insert(vehicleFixes).values(rows)
      .onConflictDoNothing()
      .returning({ id: vehicleFixes.id });
    result.fixes = inserted.length;
    result.duplicateFixes = rows.length - inserted.length;
  }
  for (const track of tracks.values()) {
    const ts = newestByTrack.get(track.id);
    if (!ts) continue;
    if (!track.lastFixAt || ts > track.lastFixAt) {
      await db.update(vehicleTracks).set({ lastFixAt: ts }).where(eq(vehicleTracks.id, track.id));
    }
    if (!track.weather) void snapshotWeather(track.id);
  }

  // Stop arrivals and departures. Kept per route, so only a bound track's
  // events are recorded; the first arrival and the last departure win.
  for (const e of payload.stopEvents ?? []) {
    const track = tracks.get(e.track);
    if (!track) { unknown.add(e.track); continue; }
    if (!track.routeId) { result.unboundStopEvents++; continue; }
    const stop = track.stops.find((s) => s.key === e.stop);
    const at = new Date(e.at);
    await db.insert(busStopVisits)
      .values({
        routeId: track.routeId,
        trackId: track.id,
        tripDate: track.tripDate,
        dayOfWeek: weekdayOfKey(track.tripDate),
        stopKey: e.stop,
        stopOrder: stop?.order ?? 0,
        kind: stop?.kind ?? null,
        plannedAt: stop?.plannedAt ? new Date(stop.plannedAt) : null,
        arrivedAt: e.kind === 'arrived' ? at : null,
        departedAt: e.kind === 'departed' ? at : null,
      })
      .onConflictDoUpdate({
        target: [busStopVisits.routeId, busStopVisits.tripDate, busStopVisits.stopKey],
        // `excluded` is the row this insert proposed, so the new time goes
        // through Drizzle's own timestamp mapping rather than a raw parameter.
        set: e.kind === 'arrived'
          ? { arrivedAt: sql`COALESCE(${busStopVisits.arrivedAt}, excluded.arrived_at)` }
          : { departedAt: sql`GREATEST(${busStopVisits.departedAt}, excluded.departed_at)` },
      });
    result.stopEvents++;
  }

  for (const p of payload.progress ?? []) {
    const track = tracks.get(p.track);
    if (!track) { unknown.add(p.track); continue; }
    await db.update(vehicleTracks)
      .set({ progress: { lastVisitedStop: p.lastVisitedStop, totalStops: p.totalStops } })
      .where(eq(vehicleTracks.id, track.id));
  }

  // Measuring the projection must never cost a position, so a failure here
  // is logged and the payload still counts as stored.
  const bound = [...tracks.values()].filter((t) => t.routeId).map((t) => t.id);
  try {
    await recordEtaSnapshots(bound, now);
  } catch (err) {
    console.error('[bus-live] ETA snapshot failed:', err);
  }

  result.unknownTracks = unknown.size;
  return result;
}
