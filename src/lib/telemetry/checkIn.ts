/**
 * Weekly anonymous check-in: build the payload, POST it to the collector, and
 * record the latest version the collector reports back (for the Settings
 * "update available" line). Every failure is swallowed — telemetry must never
 * affect the running app.
 */
import { APP_VERSION } from '@/lib/constants';
import { getDeploymentChannel } from '@/lib/config/runtime';
import {
  TELEMETRY_SCHEMA_VERSION,
  TELEMETRY_SETTING_KEYS,
  getTelemetryEndpoint,
  type TelemetryPayload,
} from './constants';
import { getOrCreateInstanceId } from './instanceId';
import { readSetting, writeSetting } from './store';

/**
 * Whether check-ins are allowed right now.
 *   - `PRISM_DISABLE_TELEMETRY=true` hard-disables (distro / enterprise builds).
 *   - An explicit `telemetry.enabled === false` setting = user opted out.
 *   - Otherwise enabled (opt-out default).
 * Note: a configured endpoint is required to actually send, checked separately
 * so the Settings UI can still show the toggle state on an inert build.
 */
export async function isTelemetryEnabled(): Promise<boolean> {
  if (process.env.PRISM_DISABLE_TELEMETRY === 'true') return false;
  const setting = await readSetting<boolean>(TELEMETRY_SETTING_KEYS.enabled);
  return setting !== false;
}

/** Build the exact anonymous payload that will be sent. */
export async function buildPayload(): Promise<TelemetryPayload> {
  return {
    schema: TELEMETRY_SCHEMA_VERSION,
    id: await getOrCreateInstanceId(),
    version: APP_VERSION,
    deployment: getDeploymentChannel(),
    arch: process.arch,
  };
}

type CheckInResult = {
  sent: boolean;
  latestVersion?: string;
  reason?: string;
};

/**
 * Perform one check-in. Safe to call anytime; returns a small result object for
 * the "check now" button in Settings. Never throws.
 */
export async function runCheckIn(): Promise<CheckInResult> {
  try {
    if (!(await isTelemetryEnabled())) return { sent: false, reason: 'disabled' };

    const endpoint = getTelemetryEndpoint();
    if (!endpoint) return { sent: false, reason: 'no-endpoint' };

    const payload = await buildPayload();

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // Don't let a slow/hanging collector stall the cron tick.
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return { sent: false, reason: `http-${res.status}` };

    // The collector may answer with the latest published version so we can
    // surface an update notice. Everything here is best-effort.
    let latestVersion: string | undefined;
    try {
      const data = (await res.json()) as { latestVersion?: unknown };
      if (typeof data.latestVersion === 'string' && data.latestVersion) {
        latestVersion = data.latestVersion.replace(/^v/, '');
        await writeSetting(TELEMETRY_SETTING_KEYS.latestVersion, latestVersion);
      }
    } catch {
      /* collector returned no/invalid JSON — fine */
    }

    await writeSetting(TELEMETRY_SETTING_KEYS.lastCheckAt, new Date().toISOString());
    return { sent: true, latestVersion };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : 'error' };
  }
}

export { compareVersions, isNotifiableUpdate } from './version';
