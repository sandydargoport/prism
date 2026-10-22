/**
 * Daily retention sweep for live bus tracking (see bus-live-retention.ts).
 *
 * Nobody reads old traces, so a read-triggered cleanup like the audit log's
 * would never run. A timer does, once at boot and then every 24 hours.
 */

import { cleanupLiveTracking } from '@/lib/services/bus-live-retention';

const INTERVAL_MS = 24 * 60 * 60 * 1000;
const INITIAL_DELAY_MS = 120 * 1000; // stagger after the calendar and photo crons

async function runOnce() {
  try {
    const { tracks, visits } = await cleanupLiveTracking();
    if (tracks > 0 || visits > 0) {
      console.log(`[bus-retention] removed ${tracks} track(s), ${visits} stop visit(s)`);
    }
  } catch (err) {
    console.error('[bus-retention] sweep failed:', err);
  }
}

export function startBusRetentionCron(): void {
  if (process.env.NODE_ENV === 'test') return;

  setTimeout(() => {
    void runOnce();
    setInterval(() => void runOnce(), INTERVAL_MS);
  }, INITIAL_DELAY_MS);
}
