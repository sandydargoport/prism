/**
 * Pull birthdays out of CardDAV contacts and upsert into the birthdays
 * table. Credentials are reused from any existing CalDAV calendar_source
 * row whose syncErrors carries `contactBirthdaysEnabled: true` — the user
 * opts in by checking a box in the CalDAV connect dialog. One row's creds
 * are enough; we don't multi-tenant this. (If the user ever wants per-iCloud-
 * account isolation, this is the place to fan out.)
 */

import { db } from '@/lib/db/client';
import { calendarSources } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { decrypt } from '@/lib/utils/crypto';
import { fetchCardDAVBirthdays } from '@/lib/integrations/carddav';
import { upsertBirthday } from './birthday-merge';

interface SyncResult {
  synced: number;
  errors: string[];
}

export async function syncCardDAVBirthdays(): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, errors: [] };

  const enabledSource = await db.query.calendarSources.findFirst({
    where: and(
      eq(calendarSources.provider, 'caldav'),
      sql`(${calendarSources.syncErrors}->>'contactBirthdaysEnabled')::boolean = true`,
    ),
  });

  if (!enabledSource) return result;

  const cfg = (enabledSource.syncErrors as Record<string, unknown> | null) ?? {};
  const serverUrl = String(cfg.serverUrl || '');
  const username = String(cfg.username || '');
  if (!serverUrl || !username || !enabledSource.accessToken) {
    result.errors.push('CardDAV sync: source row missing credentials');
    return result;
  }

  let password: string;
  try {
    password = decrypt(enabledSource.accessToken);
  } catch (err) {
    result.errors.push(`CardDAV sync: failed to decrypt password — ${err instanceof Error ? err.message : err}`);
    return result;
  }

  let contacts;
  try {
    contacts = await fetchCardDAVBirthdays(serverUrl, username, password);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`CardDAV fetch failed: ${msg}`);
    return result;
  }

  // upsertBirthday handles three cases per contact:
  //   - exact name match → refresh fields
  //   - prefix match (e.g. existing "Alex" with our new "Alex Doe" or
  //     vice versa, same month/day) → merge, keeping the longer name and the
  //     non-1904 year. Avoids the cross-source dupes we used to accumulate
  //     when Google Calendar carried a first name and CardDAV the full name.
  //   - no match → insert new
  for (const c of contacts) {
    try {
      await upsertBirthday({
        name: c.name,
        birthDate: c.birthDate,
        eventType: 'birthday',
        source: 'caldav_contacts',
      });
      result.synced++;
    } catch (err) {
      result.errors.push(`Upsert failed for "${c.name}": ${err instanceof Error ? err.message : err}`);
    }
  }

  return result;
}
