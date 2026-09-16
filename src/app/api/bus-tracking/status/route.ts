import { NextResponse } from 'next/server';
import { getDisplayAuth } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { busRoutes } from '@/lib/db/schema';
import { getCached } from '@/lib/cache/redis';
import { getRedisClient } from '@/lib/cache/getRedisClient';
import { predictArrival } from '@/lib/services/bus-arrival-predictor';
import { isGmailConnected, syncBusEmails } from '@/lib/services/bus-tracking-sync';
import { logError } from '@/lib/utils/logError';

/**
 * Fire-and-forget: sync Gmail emails with a mutex lock (not a cooldown).
 * The lock only lives while a sync is in progress — once complete, the next
 * poll immediately triggers a fresh sync. This minimizes lag to just the
 * Gmail API round-trip time (~1-2s) rather than an arbitrary cooldown.
 */
async function triggerSyncIfNeeded() {
  const client = await getRedisClient();
  if (client) {
    // NX = only set if not exists (mutex). EX = 30s safety TTL in case process crashes.
    const acquired = await client.set('bus:sync-lock', '1', { NX: true, EX: 30 });
    if (!acquired) return; // another sync is in progress
  }
  try {
    const result = await syncBusEmails();
    if (result.skippedReasons.length > 0) {
      // Count only. Each reason quotes an email subject, which names a child and
      // a school; the reasons themselves still reach the family's own UI.
      console.warn(`Bus sync: ${result.skippedReasons.length} email(s) skipped`);
    }
  } finally {
    // Release lock immediately so next poll can sync
    if (client) await client.del('bus:sync-lock').catch(() => {});
  }
}

export async function GET() {
  const auth = await getDisplayAuth();
  if (!auth) {
    return NextResponse.json({ routes: [], connected: false });
  }

  // Trigger background email sync (debounced, non-blocking)
  triggerSyncIfNeeded().catch(err =>
    console.error('Background bus sync failed:', err instanceof Error ? err.message : err)
  );

  try {
    const data = await getCached('bus:status', async () => {
      const routes = await db.select().from(busRoutes).where(eq(busRoutes.enabled, true));
      const connected = await isGmailConnected();

      const routesWithStatus = await Promise.all(
        routes.map(async (route) => {
          const prediction = await predictArrival(route.id);
          return {
            id: route.id,
            label: route.label,
            studentName: route.studentName,
            direction: route.direction,
            scheduledTime: route.scheduledTime,
            activeDays: route.activeDays,
            checkpoints: route.checkpoints,
            stopName: route.stopName,
            schoolName: route.schoolName,
            prediction,
          };
        })
      );

      return { routes: routesWithStatus, connected };
    }, 5); // 5s cache — matches fastest polling interval during active tracking

    return NextResponse.json(data);
  } catch (error) {
    logError('Failed to get bus status:', error);
    return NextResponse.json({ error: 'Failed to get bus status' }, { status: 500 });
  }
}
