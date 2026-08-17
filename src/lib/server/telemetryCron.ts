/**
 * Server-side anonymous update-check / telemetry cron.
 *
 * Lives in its own file (like calendarSyncCron) so the Edge runtime bundle of
 * instrumentation.ts never pulls in the db/crypto chains — instrumentation.ts
 * imports it only inside the `NEXT_RUNTIME === 'nodejs'` branch.
 *
 * Runs weekly and is a no-op unless:
 *   - a collector endpoint is configured (PRISM_TELEMETRY_URL / DEFAULT_TELEMETRY_ENDPOINT), and
 *   - telemetry is enabled (opt-out default; off if the user disabled it or PRISM_DISABLE_TELEMETRY=true).
 *
 * See src/lib/telemetry/constants.ts for the full privacy contract.
 */
import { runCheckIn } from '@/lib/telemetry/checkIn';
import { getTelemetryEndpoint } from '@/lib/telemetry/constants';

const INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // weekly
const INITIAL_DELAY_MS = 5 * 60 * 1000; // 5 min after boot, past startup churn

async function tick() {
  try {
    const result = await runCheckIn();
    if (result.sent) {
      console.log(
        `[telemetry] checked in${result.latestVersion ? ` (latest: ${result.latestVersion})` : ''}`,
      );
    }
    // A skipped check-in (disabled / no endpoint) is intentionally silent.
  } catch (err) {
    console.error('[telemetry] tick failed:', err);
  }
}

export function startTelemetryCron(): void {
  if (process.env.PRISM_DISABLE_TELEMETRY === 'true') {
    console.log('[telemetry] disabled via PRISM_DISABLE_TELEMETRY');
    return;
  }
  if (process.env.NODE_ENV === 'test') return;

  // If no collector is configured yet, don't even schedule — keeps the feature
  // fully inert on builds where the maintainer hasn't set an endpoint.
  if (!getTelemetryEndpoint()) {
    console.log('[telemetry] no collector endpoint configured — check-in disabled');
    return;
  }

  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), INTERVAL_MS);
  }, INITIAL_DELAY_MS);

  console.log(
    `[telemetry] scheduled weekly (first run in ${INITIAL_DELAY_MS / 1000}s)`,
  );
}
