import { NextRequest, NextResponse } from 'next/server';
import { and, asc, count, desc, eq, gt, inArray, isNotNull, lt } from 'drizzle-orm';
import { getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { busRoutes, busStopVisits, settings, vehicleFixes, vehicleTracks } from '@/lib/db/schema';
import { getHouseholdTimezone } from '@/lib/householdTimezone';
import { todayKey } from '@/lib/utils/zonedDate';
import { thinPath, type LngLat } from '@/lib/map/routeAhead';
import { pickRiderStop, projectStops } from '@/lib/services/bus-eta';
import { firstMoves } from '@/lib/services/bus-history';
import { logError } from '@/lib/utils/logError';
import { BUS_DRIVER_NAMES_SETTING, driverLabel, isDriverNames, type DriverNames } from '@/lib/services/bus-driver-names';
import {
  BUS_MAP_CAMERA_SETTING, BUS_MAP_STYLE_SETTING, DEFAULT_BUS_MAP_CAMERA, DEFAULT_BUS_MAP_STYLE,
  isBusMapCamera, isBusMapStyle,
} from '@/lib/map/busMapOptions';

/**
 * Fixes are fetched by when they were received, not by their own time, so a
 * late fix for an earlier moment is still delivered. The cursor steps back a
 * little because concurrent ingests can commit out of order; the client
 * drops the repeats by id.
 */
const CURSOR_OVERLAP_MS = 10_000;
const MAX_FIXES = 3000;

/** From the Units setting in Display settings, which is stored under `weather`. */
async function speedUnit(): Promise<'mph' | 'km/h'> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, 'weather'));
    const units = (row?.value as { units?: string } | undefined)?.units;
    if (units === 'metric') return 'km/h';
    if (units === 'imperial') return 'mph';
  } catch { /* fall through */ }
  return (process.env.WEATHER_UNITS ?? '').toLowerCase() === 'metric' ? 'km/h' : 'mph';
}

/** How the map looks: the style and camera from Live Tracking settings. */
async function mapDisplay() {
  const display = {
    mapStyle: DEFAULT_BUS_MAP_STYLE,
    camera: DEFAULT_BUS_MAP_CAMERA,
  };
  try {
    const rows = await db.select().from(settings)
      .where(inArray(settings.key, [BUS_MAP_STYLE_SETTING, BUS_MAP_CAMERA_SETTING]));
    for (const row of rows) {
      if (row.key === BUS_MAP_STYLE_SETTING && isBusMapStyle(row.value)) display.mapStyle = row.value;
      if (row.key === BUS_MAP_CAMERA_SETTING && isBusMapCamera(row.value)) display.camera = row.value;
    }
  } catch { /* defaults */ }
  return display;
}

/** A trip with fewer fixes than this did not record enough of the route to follow. */
const MIN_USUAL_FIXES = 20;

/**
 * The route as the bus last drove it: the trace of the most recent earlier
 * trip on this route that recorded enough of it, thinned for drawing. The
 * widget draws the road ahead along it. Null before there is such a trip.
 */
async function usualPath(routeId: string, before: string): Promise<LngLat[] | null> {
  const recent = await db
    .select({ id: vehicleTracks.id, fixes: count(vehicleFixes.id) })
    .from(vehicleTracks)
    .innerJoin(vehicleFixes, eq(vehicleFixes.trackId, vehicleTracks.id))
    .where(and(eq(vehicleTracks.routeId, routeId), lt(vehicleTracks.tripDate, before)))
    .groupBy(vehicleTracks.id, vehicleTracks.tripDate)
    .orderBy(desc(vehicleTracks.tripDate))
    .limit(5);
  const last = recent.find((t) => t.fixes >= MIN_USUAL_FIXES);
  if (!last) return null;
  const points = await db
    .select({ lat: vehicleFixes.lat, lng: vehicleFixes.lng })
    .from(vehicleFixes)
    .where(eq(vehicleFixes.trackId, last.id))
    .orderBy(asc(vehicleFixes.ts));
  return thinPath(points.map((p): LngLat => [p.lng, p.lat]));
}

async function driverNames(): Promise<DriverNames> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, BUS_DRIVER_NAMES_SETTING));
    if (isDriverNames(row?.value)) return row.value;
  } catch { /* fall through */ }
  return {};
}

/**
 * GET /api/bus-tracking/live?since=<cursor>
 *
 * Today's live tracks that are linked to an enabled route, with projected
 * stop times, and the fixes received since `since` (all of today's without it).
 */
export async function GET(request: NextRequest) {
  const auth = await getDisplayAuth();
  if (!auth) return NextResponse.json({ tracks: [] });

  const sinceParam = request.nextUrl.searchParams.get('since');
  const since = sinceParam ? new Date(sinceParam) : null;
  if (since && Number.isNaN(since.getTime())) {
    return NextResponse.json({ error: 'Invalid since' }, { status: 400 });
  }

  try {
    const now = new Date();
    const timeZone = await getHouseholdTimezone();
    const rows = await db
      .select({ track: vehicleTracks, route: busRoutes })
      .from(vehicleTracks)
      .innerJoin(busRoutes, eq(vehicleTracks.routeId, busRoutes.id))
      .where(and(
        eq(vehicleTracks.tripDate, todayKey(timeZone, now)),
        isNotNull(vehicleTracks.routeId),
        eq(busRoutes.enabled, true),
      ));

    const ids = rows.map((r) => r.track.id);
    const today = todayKey(timeZone, now);
    // Sent once, with the first full load; later polls only bring new fixes.
    const usual = new Map<string, LngLat[] | null>();
    if (!since) {
      for (const routeId of new Set(rows.map((r) => r.route.id))) {
        usual.set(routeId, await usualPath(routeId, today).catch(() => null));
      }
    }
    const [visits, fixes, unit, display, names, moved] = await Promise.all([
      ids.length
        ? db.select().from(busStopVisits).where(inArray(busStopVisits.trackId, ids))
        : Promise.resolve([]),
      ids.length
        ? db.select().from(vehicleFixes)
          .where(since
            ? and(inArray(vehicleFixes.trackId, ids), gt(vehicleFixes.receivedAt, since))
            : inArray(vehicleFixes.trackId, ids))
          // Received order, so a capped page still moves the cursor forward.
          .orderBy(asc(vehicleFixes.receivedAt))
          .limit(MAX_FIXES)
        : Promise.resolve([]),
      speedUnit(),
      mapDisplay(),
      driverNames(),
      firstMoves(ids),
    ]);

    // With nothing new the cursor stays put; stepping back every time would
    // walk it backwards.
    let cursor = since?.toISOString() ?? null;
    if (fixes.length > 0) {
      const newest = Math.max(...fixes.map((f) => f.receivedAt.getTime()));
      // Only fixes received in the last few seconds can still be overtaken.
      const settled = now.getTime() - newest >= CURSOR_OVERLAP_MS;
      const back = settled ? newest : newest - CURSOR_OVERLAP_MS;
      cursor = new Date(Math.max(back, since?.getTime() ?? 0)).toISOString();
    }

    const tracks = rows.map(({ track, route }) => {
      const projection = projectStops(
        track.stops,
        visits.filter((v) => v.trackId === track.id),
        track.progress,
        now,
        { plannedStart: track.plannedStart, departedAt: moved.get(track.id) ?? null },
      );
      return {
        id: track.id,
        routeId: route.id,
        routeLabel: route.label,
        direction: track.direction ?? route.direction,
        label: track.label,
        status: track.status,
        vehicle: track.vehicle,
        driverLabel: driverLabel(track.vehicle?.driverName, names),
        progress: track.progress,
        plannedStart: track.plannedStart?.toISOString() ?? null,
        plannedEnd: track.plannedEnd?.toISOString() ?? null,
        lastFixAt: track.lastFixAt?.toISOString() ?? null,
        riderStopKey: pickRiderStop(track.stops, route.stopName),
        shiftMs: projection.shiftMs,
        stops: projection.stops,
        ...(since ? {} : { usualPath: usual.get(route.id) ?? null }),
        fixes: fixes
          .filter((f) => f.trackId === track.id)
          .map((f) => ({
            id: f.id,
            ts: f.ts.toISOString(),
            lat: f.lat,
            lng: f.lng,
            heading: f.heading,
            speed: f.speed,
            moving: f.moving,
            doorOpen: f.doorOpen,
          })),
      };
    });

    return NextResponse.json({ serverTime: now.toISOString(), cursor, speedUnit: unit, ...display, tracks });
  } catch (error) {
    logError('Failed to get live bus tracks:', error);
    return NextResponse.json({ error: 'Failed to get live bus tracks' }, { status: 500 });
  }
}
