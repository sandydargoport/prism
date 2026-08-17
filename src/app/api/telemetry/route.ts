import { NextResponse } from 'next/server';
import { getDisplayAuth, requireAuth, requireRole } from '@/lib/auth';
import { APP_VERSION } from '@/lib/constants';
import { logError } from '@/lib/utils/logError';
import {
  TELEMETRY_SETTING_KEYS,
  getTelemetryEndpoint,
} from '@/lib/telemetry/constants';
import {
  buildPayload,
  isTelemetryEnabled,
  runCheckIn,
} from '@/lib/telemetry/checkIn';
import { isNotifiableUpdate } from '@/lib/telemetry/version';
import { readSetting } from '@/lib/telemetry/store';

/**
 * Status for the Settings -> About telemetry card: the current opt-out state,
 * whether a collector is configured, the exact anonymous payload that would be
 * sent, and any pending update the last check-in reported.
 */
export async function GET() {
  const auth = await getDisplayAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [enabled, latestVersion, lastCheckAt, payload] = await Promise.all([
      isTelemetryEnabled(),
      readSetting<string>(TELEMETRY_SETTING_KEYS.latestVersion),
      readSetting<string>(TELEMETRY_SETTING_KEYS.lastCheckAt),
      buildPayload(),
    ]);

    return NextResponse.json({
      enabled,
      configured: Boolean(getTelemetryEndpoint()),
      hardDisabled: process.env.PRISM_DISABLE_TELEMETRY === 'true',
      version: APP_VERSION,
      latestVersion: latestVersion ?? null,
      updateAvailable: isNotifiableUpdate(APP_VERSION, latestVersion),
      lastCheckAt: lastCheckAt ?? null,
      payload,
    });
  } catch (error) {
    logError('Error reading telemetry status:', error);
    return NextResponse.json({ error: 'Failed to read telemetry status' }, { status: 500 });
  }
}

/** Run a check-in immediately (the "Check now" button). Parent-only. */
export async function POST() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const forbidden = requireRole(authResult, 'canModifySettings');
  if (forbidden) return forbidden;

  try {
    const result = await runCheckIn();
    return NextResponse.json(result);
  } catch (error) {
    logError('Error running telemetry check-in:', error);
    return NextResponse.json({ error: 'Failed to run check-in' }, { status: 500 });
  }
}
