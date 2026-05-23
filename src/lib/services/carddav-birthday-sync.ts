/**
 * Pull birthdays out of CardDAV contacts and upsert into the birthdays
 * table. Credentials are reused from any existing CalDAV calendar_source
 * row whose syncErrors carries `contactBirthdaysEnabled: true` — the user
 * opts in by checking a box in the CalDAV connect dialog. One row's creds
 * are enough; we don't multi-tenant this. (If the user ever wants per-iCloud-
 * account isolation, this is the place to fan out.)
 */

import { db } from '@/lib/db/client';
import { birthdays, calendarSources } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { decrypt } from '@/lib/utils/crypto';
import { fetchCardDAVBirthdays } from '@/lib/integrations/carddav';

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

  // Upsert each (name, birthdate) pair. The unique index on
  // (name, eventType) means a duplicate from Google + CardDAV converges
  // onto one row — the CardDAV value wins on conflict, which matches the
  // user's mental model of "iCloud is my source of truth for contacts."
  for (const c of contacts) {
    try {
      await db
        .insert(birthdays)
        .values({
          name: c.name,
          birthDate: c.birthDate,
          eventType: 'birthday',
          googleCalendarSource: 'caldav_contacts',
        })
        .onConflictDoUpdate({
          target: [birthdays.name, birthdays.eventType],
          set: {
            birthDate: c.birthDate,
            googleCalendarSource: 'caldav_contacts',
          },
        });
      result.synced++;
    } catch (err) {
      result.errors.push(`Upsert failed for "${c.name}": ${err instanceof Error ? err.message : err}`);
    }
  }

  return result;
}
