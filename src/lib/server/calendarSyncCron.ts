/**
 * Server-side calendar sync cron.
 *
 * Lives in its own file so the Edge runtime bundle of instrumentation.ts
 * does NOT try to pull in node-ical, redis client, and node:crypto chains.
 * instrumentation.ts dynamically imports this module only inside the
 * `NEXT_RUNTIME === 'nodejs'` branch, so webpack dead-code eliminates the
 * import from the edge bundle entirely.
 *
 * Why: calendar sync was previously client-driven. If nobody had Prism's
 * dashboard or calendar page open, no syncs ran. After docker restarts or
 * extended quiet periods, events silently went stale.
 */

import { syncAllGoogleCalendars, syncAllIcalCalendars, syncAllCalDAVCalendars } from '@/lib/services/calendar-sync';
import { syncCardDAVBirthdays } from '@/lib/services/carddav-birthday-sync';
import { invalidateEntity } from '@/lib/cache/cacheKeys';

const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const INITIAL_DELAY_MS = 60 * 1000;  // wait 1 min after boot

async function runOnce() {
  try {
    const [google, ical, caldav, carddav] = await Promise.all([
      syncAllGoogleCalendars(),
      syncAllIcalCalendars(),
      syncAllCalDAVCalendars(),
      syncCardDAVBirthdays(),
    ]);
    const total = google.total + ical.total + caldav.total + carddav.synced;
    const errors = [...google.errors, ...ical.errors, ...caldav.errors, ...carddav.errors];

    await invalidateEntity('events');
    // CalDAV sources also sync VTODO into the tasks table; invalidate that
    // cache too so the Tasks page picks up new / updated reminders.
    await invalidateEntity('tasks');
    if (carddav.synced > 0) await invalidateEntity('birthdays');

    if (errors.length > 0) {
      console.warn(
        `[calendar-cron] synced ${total} events/tasks with ${errors.length} errors:`,
        errors.slice(0, 3),
      );
    } else {
      console.log(`[calendar-cron] synced ${total} events/tasks`);
    }
  } catch (err) {
    // Never let a transient sync failure crash the cron loop.
    console.error('[calendar-cron] tick failed:', err);
  }
}

export function startCalendarSyncCron(): void {
  if (process.env.PRISM_DISABLE_CALENDAR_CRON === 'true') {
    console.log('[calendar-cron] disabled via PRISM_DISABLE_CALENDAR_CRON');
    return;
  }
  if (process.env.NODE_ENV === 'test') return;

  setTimeout(() => {
    void runOnce();
    setInterval(() => void runOnce(), INTERVAL_MS);
  }, INITIAL_DELAY_MS);

  console.log(
    `[calendar-cron] scheduled every ${INTERVAL_MS / 1000}s (first run in ${INITIAL_DELAY_MS / 1000}s)`,
  );
}
