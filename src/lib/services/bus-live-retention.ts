/**
 * Retention for live bus tracking. The trace (tracks and their fixes) is
 * where a child's bus was, minute by minute, so it is kept only for the
 * trace window. Stop visits are arrival times at each stop, which is all the
 * arrival prediction needs, and they are kept for the longer history window.
 */

import { eq, lt } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { busEtaSnapshots, busStopVisits, busTrips, settings, vehicleTracks } from '@/lib/db/schema';
import { getHouseholdTimezone } from '@/lib/householdTimezone';
import { addDaysToKey, todayKey } from '@/lib/utils/zonedDate';

export const BUS_RETENTION_KEYS = {
  trace: 'busTraceRetentionDays',
  history: 'busHistoryRetentionDays',
} as const;

export const BUS_RETENTION_LIMITS = {
  trace: { min: 1, max: 365, default: 30 },
  history: { min: 1, max: 1825, default: 365 },
} as const;

/** True when `value` is a whole number of days the setting accepts. */
export function isValidRetention(kind: keyof typeof BUS_RETENTION_LIMITS, value: unknown): boolean {
  const { min, max } = BUS_RETENTION_LIMITS[kind];
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

async function readDays(kind: keyof typeof BUS_RETENTION_LIMITS): Promise<number> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, BUS_RETENTION_KEYS[kind]));
    if (isValidRetention(kind, row?.value)) return row!.value as number;
  } catch { /* fall through to the default */ }
  return BUS_RETENTION_LIMITS[kind].default;
}

export const getTraceRetentionDays = () => readDays('trace');
export const getHistoryRetentionDays = () => readDays('history');

/**
 * Deletes tracks (and, by cascade, their fixes) older than the trace window,
 * and stop visits, trip summaries and ETA snapshots older than the history
 * window. Days are the household's calendar days.
 */
export async function cleanupLiveTracking(now: Date = new Date()): Promise<{ tracks: number; visits: number }> {
  const today = todayKey(await getHouseholdTimezone(), now);
  const traceCutoff = addDaysToKey(today, -(await getTraceRetentionDays()));
  const historyCutoff = addDaysToKey(today, -(await getHistoryRetentionDays()));

  const tracks = await db.delete(vehicleTracks)
    .where(lt(vehicleTracks.tripDate, traceCutoff))
    .returning({ id: vehicleTracks.id });
  const visits = await db.delete(busStopVisits)
    .where(lt(busStopVisits.tripDate, historyCutoff))
    .returning({ id: busStopVisits.id });
  await db.delete(busTrips).where(lt(busTrips.tripDate, historyCutoff));
  await db.delete(busEtaSnapshots).where(lt(busEtaSnapshots.tripDate, historyCutoff));

  return { tracks: tracks.length, visits: visits.length };
}
