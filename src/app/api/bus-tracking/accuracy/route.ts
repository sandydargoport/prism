import { NextResponse } from 'next/server';
import { inArray } from 'drizzle-orm';
import { withAuth } from '@/lib/api/withAuth';
import { db } from '@/lib/db/client';
import { busRoutes } from '@/lib/db/schema';
import { loadAccuracy } from '@/lib/services/bus-eta-snapshots';
import { logError } from '@/lib/utils/logError';

/**
 * GET /api/bus-tracking/accuracy
 *
 * How close the projected arrival at the household's stop has been, per
 * route and lead time, over the last 90 days. Only trips that reached the
 * stop are scored.
 */
export async function GET() {
  return withAuth(async () => {
    try {
      const routes = await loadAccuracy();
      const labels = routes.length
        ? await db.select({ id: busRoutes.id, label: busRoutes.label }).from(busRoutes)
          .where(inArray(busRoutes.id, routes.map((r) => r.routeId)))
        : [];
      const label = new Map(labels.map((l) => [l.id, l.label]));
      return NextResponse.json({
        routes: routes.map((r) => ({ ...r, label: label.get(r.routeId) ?? null })),
      });
    } catch (error) {
      logError('Failed to get bus prediction accuracy:', error);
      return NextResponse.json({ error: 'Failed to get bus prediction accuracy' }, { status: 500 });
    }
  });
}
