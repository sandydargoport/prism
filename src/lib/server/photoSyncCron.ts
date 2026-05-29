/**
 * Server-side photo sync cron.
 *
 * Same rationale as calendarSyncCron: photo sources (OneDrive folders,
 * Immich shared links) previously only synced when someone hit the manual
 * /api/photo-sources/[id]/sync endpoint. So a folder the user dropped new
 * photos into wouldn't appear on the dashboard until they remembered to
 * trigger a sync. This periodic loop makes "drop a photo in the folder →
 * it shows up" actually automatic.
 *
 * Lives in its own node-only module (imported lazily from instrumentation.ts
 * under NEXT_RUNTIME === 'nodejs') so the edge bundle never pulls in the
 * heavy transitive deps (exifr, sharp via photo-storage, etc.).
 *
 * Interval is longer than the calendar cron — photos change far less often
 * than calendar events, and OneDrive/Immich list calls are heavier.
 */

import { syncAllPhotoSources } from '@/lib/services/photo-sync';
import { invalidateEntity } from '@/lib/cache/cacheKeys';

const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const INITIAL_DELAY_MS = 90 * 1000;  // wait 90s after boot (stagger vs calendar cron)

async function runOnce() {
  try {
    const { synced, errors } = await syncAllPhotoSources();
    if (synced > 0) await invalidateEntity('photos');

    if (errors.length > 0) {
      console.warn(
        `[photo-cron] synced ${synced} source(s) with ${errors.length} errors:`,
        errors.slice(0, 3),
      );
    } else {
      console.log(`[photo-cron] synced ${synced} source(s)`);
    }
  } catch (err) {
    console.error('[photo-cron] tick failed:', err);
  }
}

export function startPhotoSyncCron(): void {
  if (process.env.PRISM_DISABLE_PHOTO_CRON === 'true') {
    console.log('[photo-cron] disabled via PRISM_DISABLE_PHOTO_CRON');
    return;
  }
  if (process.env.NODE_ENV === 'test') return;

  setTimeout(() => {
    void runOnce();
    setInterval(() => void runOnce(), INTERVAL_MS);
  }, INITIAL_DELAY_MS);

  console.log(
    `[photo-cron] scheduled every ${INTERVAL_MS / 1000}s (first run in ${INITIAL_DELAY_MS / 1000}s)`,
  );
}
