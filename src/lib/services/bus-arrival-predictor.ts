/**
 * Predicts bus arrival times based on historical geofence crossing data.
 * Uses rolling stats on transit times between consecutive checkpoint pairs.
 */

import { db } from '@/lib/db/client';
import { busGeofenceLog, busRoutes } from '@/lib/db/schema';
import { getHouseholdTimezone } from '@/lib/householdTimezone';
import { todayKey, weekdayOfKey } from '@/lib/utils/zonedDate';
import { scheduledInstantToday } from './bus-tracking-sync';
import { eq, and, gte, desc } from 'drizzle-orm';

export type BusStatus =
  | 'no_data'        // No checkpoint data today
  | 'cold_start'     // < 5 data points per segment, can't predict
  | 'in_transit'     // Bus is between checkpoints
  | 'at_stop'        // Bus arrived at stop
  | 'at_school'      // Bus arrived at school
  | 'overdue';       // Past scheduled time with no recent updates

export interface ArrivalPrediction {
  status: BusStatus;
  etaMinutes: number | null;
  etaRangeLow: number | null;
  etaRangeHigh: number | null;
  lastCheckpointName: string | null;
  lastCheckpointTime: Date | null;
  lastCheckpointIndex: number;
  totalCheckpoints: number;  // includes stop + school
  minutesSinceLastCheckpoint: number | null;
}

interface SegmentStat {
  fromIndex: number;
  toIndex: number;
  medianMinutes: number;
  p25Minutes: number;
  p75Minutes: number;
  sampleCount: number;
}

const MIN_SAMPLES_FOR_PREDICTION = 5;
const HISTORY_DAYS = 30;

/**
 * Get arrival prediction for a bus route.
 */
export async function predictArrival(routeId: string): Promise<ArrivalPrediction> {
  const route = await db.query.busRoutes.findFirst({
    where: eq(busRoutes.id, routeId),
  });

  if (!route) {
    return emptyPrediction(0);
  }

  const checkpoints = (route.checkpoints as { name: string; sortOrder: number }[]) || [];

  // ETA target: find the stopName checkpoint within the named list.
  // stopName is now selected from checkpoint names (e.g. "Home"), so ETA
  // targets that index rather than the implicit school terminal.
  const stopIdx = route.stopName
    ? checkpoints.findIndex(cp => cp.name === route.stopName)
    : -1;
  // Upper bound for ETA segment calculation
  const etaTargetCount = stopIdx >= 0
    ? stopIdx + 1
    : checkpoints.length + (route.stopName ? 1 : 0);  // fallback: implicit stop after named checkpoints

  // Full display count (includes school for AM — used by widget progress display)
  const totalCheckpoints = checkpoints.length + (route.stopName && stopIdx < 0 ? 1 : 0) + (route.schoolName ? 1 : 0);

  // Check if today is an active day for this route (default weekdays [1-5])
  const activeDays = (route.activeDays as number[]) || [1, 2, 3, 4, 5];
  // The household's today and weekday, not the server's (UTC on a default
  // install, where a US evening is already tomorrow).
  const timeZone = await getHouseholdTimezone();
  const todayStr = todayKey(timeZone);
  const todayDow = weekdayOfKey(todayStr); // 0=Sun, 1=Mon, ..., 6=Sat
  if (!activeDays.includes(todayDow)) {
    return emptyPrediction(totalCheckpoints);
  }

  // Get today's events for this route
  const todayEvents = await db.select()
    .from(busGeofenceLog)
    .where(and(
      eq(busGeofenceLog.routeId, routeId),
      eq(busGeofenceLog.tripDate, todayStr),
    ))
    .orderBy(desc(busGeofenceLog.eventTime));

  if (todayEvents.length === 0) {
    // Check if overdue
    if (isOverdue(route.scheduledTime, timeZone)) {
      return { ...emptyPrediction(totalCheckpoints), status: 'overdue' };
    }
    return emptyPrediction(totalCheckpoints);
  }

  // Latest checkpoint (guaranteed non-empty after length check)
  const latest = todayEvents[0]!;
  const lastCheckpointIndex = latest.checkpointIndex;
  const lastCheckpointName = latest.checkpointName;
  const lastCheckpointTime = latest.eventTime;
  const minutesSince = (Date.now() - lastCheckpointTime.getTime()) / 60000;

  const direction = route.direction as 'AM' | 'PM';

  // Terminal states depend on direction:
  // AM: school is the final destination
  // PM: stop is the final destination (school is the origin)
  if (latest.eventType === 'arrived_at_stop') {
    return {
      status: 'at_stop',
      etaMinutes: 0,
      etaRangeLow: 0,
      etaRangeHigh: 0,
      lastCheckpointName,
      lastCheckpointTime,
      lastCheckpointIndex,
      totalCheckpoints,
      minutesSinceLastCheckpoint: Math.round(minutesSince),
    };
  }

  if (latest.eventType === 'arrived_at_school') {
    if (direction === 'AM') {
      // AM: school is the destination — trip complete
      return {
        status: 'at_school',
        etaMinutes: 0,
        etaRangeLow: 0,
        etaRangeHigh: 0,
        lastCheckpointName,
        lastCheckpointTime,
        lastCheckpointIndex,
        totalCheckpoints,
        minutesSinceLastCheckpoint: Math.round(minutesSince),
      };
    }
    // PM: school is the origin — bus is loading at school, hasn't hit any route
    // checkpoints yet. The stored checkpointIndex may be an implicit terminal index
    // (beyond etaTargetCount) which causes getSegmentStats to return nothing.
    // Return cold_start with lastCheckpointIndex = -1 so the train map shows all
    // nodes as unvisited. Once the bus hits its first geofence, normal prediction kicks in.
    return {
      status: 'cold_start',
      etaMinutes: null,
      etaRangeLow: null,
      etaRangeHigh: null,
      lastCheckpointName,
      lastCheckpointTime,
      lastCheckpointIndex: -1,
      totalCheckpoints,
      minutesSinceLastCheckpoint: Math.round(minutesSince),
    };
  }

  // Bus is in transit — try to predict remaining time up to the ETA target
  const segments = await getSegmentStats(routeId, lastCheckpointIndex, etaTargetCount);

  // Check if we have enough data for prediction
  const hasEnoughData = segments.every(s => s.sampleCount >= MIN_SAMPLES_FOR_PREDICTION);

  if (!hasEnoughData) {
    return {
      status: 'cold_start',
      etaMinutes: null,
      etaRangeLow: null,
      etaRangeHigh: null,
      lastCheckpointName,
      lastCheckpointTime,
      lastCheckpointIndex,
      totalCheckpoints,
      minutesSinceLastCheckpoint: Math.round(minutesSince),
    };
  }

  // Sum remaining segment times (subtract time already in transit from first segment)
  let etaMedian = 0;
  let etaLow = 0;
  let etaHigh = 0;

  for (const seg of segments) {
    etaMedian += seg.medianMinutes;
    etaLow += seg.p25Minutes;
    etaHigh += seg.p75Minutes;
  }

  // Subtract time already spent since last checkpoint
  etaMedian = Math.max(0, Math.round(etaMedian - minutesSince));
  etaLow = Math.max(0, Math.round(etaLow - minutesSince));
  etaHigh = Math.max(0, Math.round(etaHigh - minutesSince));

  return {
    status: 'in_transit',
    etaMinutes: etaMedian,
    etaRangeLow: etaLow,
    etaRangeHigh: etaHigh,
    lastCheckpointName,
    lastCheckpointTime,
    lastCheckpointIndex,
    totalCheckpoints,
    minutesSinceLastCheckpoint: Math.round(minutesSince),
  };
}

/**
 * Get historical transit time statistics for segments from currentIndex to end.
 */
async function getSegmentStats(
  routeId: string,
  fromCheckpointIndex: number,
  totalCheckpoints: number
): Promise<SegmentStat[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - HISTORY_DAYS);

  // Fetch all historical events for this route
  const events = await db.select()
    .from(busGeofenceLog)
    .where(and(
      eq(busGeofenceLog.routeId, routeId),
      gte(busGeofenceLog.eventTime, cutoff),
    ))
    .orderBy(busGeofenceLog.tripDate, busGeofenceLog.checkpointIndex);

  // Group events by trip date
  const byDate = new Map<string, typeof events>();
  for (const event of events) {
    const key = event.tripDate;
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(event);
  }

  // Build segments from currentIndex to end.
  // First try consecutive pairs (i, i+1). If a pair lacks data,
  // span across the gap to find any two checkpoints with data and
  // interpolate the per-segment time.
  const segments: SegmentStat[] = [];

  let i = fromCheckpointIndex;
  while (i < totalCheckpoints - 1) {
    // Try consecutive pair first
    const consecutiveTimes = collectTransitTimes(byDate, i, i + 1);

    if (consecutiveTimes.length >= MIN_SAMPLES_FOR_PREDICTION) {
      consecutiveTimes.sort((a, b) => a - b);
      segments.push({
        fromIndex: i,
        toIndex: i + 1,
        medianMinutes: percentile(consecutiveTimes, 50),
        p25Minutes: percentile(consecutiveTimes, 25),
        p75Minutes: percentile(consecutiveTimes, 75),
        sampleCount: consecutiveTimes.length,
      });
      i++;
      continue;
    }

    // Consecutive pair lacks data — try spanning across gap
    let spanned = false;
    for (let j = i + 2; j < totalCheckpoints; j++) {
      const spanTimes = collectTransitTimes(byDate, i, j);
      if (spanTimes.length >= MIN_SAMPLES_FOR_PREDICTION) {
        // Distribute the spanned time evenly across the skipped segments
        const spanCount = j - i;
        spanTimes.sort((a, b) => a - b);
        const perSegMedian = percentile(spanTimes, 50) / spanCount;
        const perSegP25 = percentile(spanTimes, 25) / spanCount;
        const perSegP75 = percentile(spanTimes, 75) / spanCount;
        for (let k = i; k < j; k++) {
          segments.push({
            fromIndex: k,
            toIndex: k + 1,
            medianMinutes: perSegMedian,
            p25Minutes: perSegP25,
            p75Minutes: perSegP75,
            sampleCount: spanTimes.length,
          });
        }
        i = j;
        spanned = true;
        break;
      }
    }

    if (!spanned) {
      // No data for any span — use whatever we have (even if < MIN_SAMPLES)
      consecutiveTimes.sort((a, b) => a - b);
      segments.push({
        fromIndex: i,
        toIndex: i + 1,
        medianMinutes: consecutiveTimes.length > 0 ? percentile(consecutiveTimes, 50) : 0,
        p25Minutes: consecutiveTimes.length > 0 ? percentile(consecutiveTimes, 25) : 0,
        p75Minutes: consecutiveTimes.length > 0 ? percentile(consecutiveTimes, 75) : 0,
        sampleCount: consecutiveTimes.length,
      });
      i++;
    }
  }

  return segments;
}

/** Collect transit times between two checkpoint indices across all historical days */
function collectTransitTimes(
  byDate: Map<string, { checkpointIndex: number; eventTime: Date }[]>,
  fromIndex: number,
  toIndex: number,
): number[] {
  const times: number[] = [];
  for (const [, dayEvents] of byDate) {
    const from = dayEvents.find(e => e.checkpointIndex === fromIndex);
    const to = dayEvents.find(e => e.checkpointIndex === toIndex);
    if (from && to) {
      const minutes = (to.eventTime.getTime() - from.eventTime.getTime()) / 60000;
      if (minutes > 0 && minutes < 120) {
        times.push(minutes);
      }
    }
  }
  return times;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower]!;
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (index - lower);
}

function emptyPrediction(totalCheckpoints: number): ArrivalPrediction {
  return {
    status: 'no_data',
    etaMinutes: null,
    etaRangeLow: null,
    etaRangeHigh: null,
    lastCheckpointName: null,
    lastCheckpointTime: null,
    lastCheckpointIndex: -1,
    totalCheckpoints,
    minutesSinceLastCheckpoint: null,
  };
}

/** Scheduled times are household wall-clock times (HH:mm). */
function isOverdue(scheduledTime: string, timeZone: string): boolean {
  const scheduled = scheduledInstantToday(scheduledTime, timeZone);
  // Overdue if more than 30 minutes past scheduled time
  return scheduled !== null && Date.now() > scheduled.getTime() + 30 * 60000;
}

