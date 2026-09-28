import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { isHouseholdZoneCandidate } from '@/lib/utils/timezone';
import { logError } from '@/lib/utils/logError';

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
  } catch (error) {
    logError('Saving the household time zone at sign-in failed:', error);
  }
}
