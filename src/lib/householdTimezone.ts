import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { isHouseholdZoneCandidate, isValidTimezone } from '@/lib/utils/timezone';
import { logError } from '@/lib/utils/logError';

/**
 * How long a read of the household zone is trusted. Writes through the
 * settings API and sign-in clear it at once; this bounds how long a change
 * made any other way (a restore, a second process) goes unseen.
 */
const CACHE_TTL_MS = 60_000;

let cached: { zone: string; expiresAt: number } | null = null;

/** The zone the server process runs in, which is UTC unless TZ is set. */
function processTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/**
 * The household's IANA time zone: what the server means by "today", and the
 * zone to pass to the helpers in utils/zonedDate.
 *
 * Falls back to the process zone when no valid zone is stored. An install no
 * parent has signed into since the zone started being saved has no row; on a
 * default Docker install the fallback is UTC, and on Home Assistant, where the
 * Supervisor sets TZ, it is the host's zone.
 *
 * Never throws. A failed read falls back without caching, so the next call
 * tries again.
 */
export async function getHouseholdTimezone(): Promise<string> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.zone;

  try {
    const [row] = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, 'timezone'));
    const stored = row?.value;
    const zone = typeof stored === 'string' && isValidTimezone(stored) ? stored : processTimezone();
    cached = { zone, expiresAt: now + CACHE_TTL_MS };
    return zone;
  } catch (error) {
    logError('Reading the household time zone failed:', error);
    return processTimezone();
  }
}

/** Forget the cached household zone. Call after writing the setting. */
export function invalidateHouseholdTimezoneCache(): void {
  cached = null;
}

/**
 * Store `zone` as the household time zone if none is stored yet. Called when a
 * parent signs in, with the zone their device reports: installs set up before
 * the wizard could save one have no household zone, and a PIN sign-in does
 * not reload the page, so the client-side backfill alone never ran after it.
 *
 * Never overwrites an existing value, never stores UTC or Etc/*, and never
 * throws: a sign-in must not fail over this.
 */
export async function saveHouseholdTimezoneIfMissing(zone: unknown): Promise<void> {
  if (!isHouseholdZoneCandidate(zone)) return;
  try {
    await db
      .insert(settings)
      .values({ key: 'timezone', value: zone })
      .onConflictDoNothing({ target: settings.key });
    invalidateHouseholdTimezoneCache();
  } catch (error) {
    logError('Saving the household time zone at sign-in failed:', error);
  }
}
