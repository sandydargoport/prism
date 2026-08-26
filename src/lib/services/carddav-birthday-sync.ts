/**
 * Pull birthdays out of CardDAV contacts and upsert into the birthdays
 * table. Credentials are reused from existing CalDAV calendar_source rows
 * whose providerConfig carries `contactBirthdaysEnabled: true` — the user
 * opts in by checking a box in the CalDAV connect dialog.
 *
 * Fans out across every opted-in account. It used to take only the first
 * match, so a household with two iCloud accounts silently synced one of them,
 * and which one depended on connection order. A failure on one account is
 * collected and the rest still run.
 *
 * Note this covers iPhone contacts: iCloud contacts are CardDAV, so ticking
 * "contact birthdays" when connecting iCloud is what makes phone birthdays
 * appear. The same path serves Nextcloud and Fastmail.
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

  const enabledSources = await db.query.calendarSources.findMany({
    where: and(
      eq(calendarSources.provider, 'caldav'),
      sql`(${calendarSources.providerConfig}->>'contactBirthdaysEnabled')::boolean = true`,
    ),
  });

  if (enabledSources.length === 0) return result;

  // One entry per distinct account: several calendars from the same iCloud
  // login can each carry the flag, and fetching their shared address book
  // more than once would just be wasted round-trips.
  const contacts: { name: string; birthDate: string }[] = [];
  const seenAccounts = new Set<string>();

  for (const source of enabledSources) {
    const cfg = (source.providerConfig as Record<string, unknown> | null) ?? {};
    const serverUrl = String(cfg.serverUrl || '');
    const username = String(cfg.username || '');
    if (!serverUrl || !username || !source.accessToken) {
      result.errors.push('CardDAV sync: source row missing credentials');
      continue;
    }

    const accountKey = `${serverUrl}|${username}`;
    if (seenAccounts.has(accountKey)) continue;
    seenAccounts.add(accountKey);

    let password: string;
    try {
      password = decrypt(source.accessToken);
    } catch (err) {
      result.errors.push(`CardDAV sync: failed to decrypt password for ${username} — ${err instanceof Error ? err.message : err}`);
      continue;
    }

    try {
      contacts.push(...(await fetchCardDAVBirthdays(serverUrl, username, password)));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`CardDAV fetch failed for ${username}: ${msg}`);
    }
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
