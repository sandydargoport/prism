import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, desc, eq, gte, isNull, max, sql } from 'drizzle-orm';
import { withAuth } from '@/lib/api/withAuth';
import { db } from '@/lib/db/client';
import { busRoutes, vehicleTracks } from '@/lib/db/schema';
import { getHouseholdTimezone } from '@/lib/householdTimezone';
import { addDaysToKey, todayKey } from '@/lib/utils/zonedDate';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logError } from '@/lib/utils/logError';
import { validateRequest } from '@/lib/validations';

/**
 * GET /api/bus-tracking/live/tracks
 *
 * The tracks providers have reported over the last week, for binding one to a
 * bus route in settings, plus when anything was last received. Only what the
 * binding needs: provider, label, direction, date and the route it is on.
 */
export async function GET() {
  return withAuth(async () => {
    try {
      const since = addDaysToKey(todayKey(await getHouseholdTimezone()), -7);
      const tracks = await db
        .select({
          id: vehicleTracks.id,
          provider: vehicleTracks.provider,
          label: vehicleTracks.label,
          direction: vehicleTracks.direction,
          tripDate: vehicleTracks.tripDate,
          routeId: vehicleTracks.routeId,
          lastFixAt: vehicleTracks.lastFixAt,
          driverName: sql<string | null>`${vehicleTracks.vehicle}->>'driverName'`,
          updatedAt: vehicleTracks.updatedAt,
        })
        .from(vehicleTracks)
        .where(gte(vehicleTracks.tripDate, since))
        .orderBy(desc(vehicleTracks.tripDate));

      const [latest] = await db.select({ at: max(vehicleTracks.updatedAt) }).from(vehicleTracks);
      return NextResponse.json({ tracks, lastReceivedAt: latest?.at ?? null });
    } catch (error) {
      logError('Failed to list live tracks:', error);
      return NextResponse.json({ error: 'Failed to list live tracks' }, { status: 500 });
    }
  }, { permission: 'canModifySettings' });
}

const bindSchema = z.object({
  trackId: z.string().uuid(),
  routeId: z.string().uuid().nullable(),
});

/**
 * PUT /api/bus-tracking/live/tracks  { trackId, routeId | null }
 *
 * Says which route a provider's track is. The route remembers the track's
 * provider, label and direction, so tomorrow's track (new key, same trip)
 * binds itself on arrival; this week's matching tracks are re-pointed now.
 * A null routeId unlinks whatever route the track was on.
 */
export async function PUT(request: NextRequest) {
  return withAuth(async () => {
    const validation = validateRequest(bindSchema, await request.json().catch(() => null));
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    const { trackId, routeId } = validation.data;

    try {
      const track = await db.query.vehicleTracks.findFirst({ where: eq(vehicleTracks.id, trackId) });
      if (!track) return NextResponse.json({ error: 'Track not found' }, { status: 404 });

      const since = addDaysToKey(todayKey(await getHouseholdTimezone()), -7);
      const sameTrip = and(
        eq(vehicleTracks.provider, track.provider),
        track.label === null ? isNull(vehicleTracks.label) : eq(vehicleTracks.label, track.label),
        track.direction === null ? isNull(vehicleTracks.direction) : eq(vehicleTracks.direction, track.direction),
        gte(vehicleTracks.tripDate, since),
      );

      if (routeId === null) {
        if (track.routeId) {
          await db.update(busRoutes).set({ liveMatch: null, updatedAt: new Date() })
            .where(eq(busRoutes.id, track.routeId));
        }
        await db.update(vehicleTracks).set({ routeId: null }).where(sameTrip);
      } else {
        const [route] = await db.update(busRoutes)
          .set({
            liveMatch: {
              provider: track.provider,
              ...(track.label !== null && { label: track.label }),
              ...(track.direction !== null && { direction: track.direction }),
            },
            updatedAt: new Date(),
          })
          .where(eq(busRoutes.id, routeId))
          .returning({ id: busRoutes.id });
        if (!route) return NextResponse.json({ error: 'Bus route not found' }, { status: 404 });
        // A route follows one trip: whatever it was bound to before lets go.
        await db.update(vehicleTracks).set({ routeId: null })
          .where(and(eq(vehicleTracks.routeId, routeId), gte(vehicleTracks.tripDate, since)));
        await db.update(vehicleTracks).set({ routeId }).where(sameTrip);
      }

      await invalidateEntity('bus');
      return NextResponse.json({ ok: true });
    } catch (error) {
      logError('Failed to bind live track:', error);
      return NextResponse.json({ error: 'Failed to bind live track' }, { status: 500 });
    }
  }, { permission: 'canModifySettings' });
}
