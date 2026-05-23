/**
 * CardDAV contacts integration — birthday-only.
 *
 * Reuses tsdav (already pulled in for CalDAV). Apple iCloud serves CardDAV
 * from a different hostname than CalDAV (contacts.icloud.com vs.
 * caldav.icloud.com); we swap automatically. For Nextcloud, Baikal, etc.
 * the same DAV root handles both protocols and the URL passes through.
 */

import { createDAVClient, type DAVCollection } from 'tsdav';
import ICAL from 'ical.js';

export interface ContactBirthday {
  /** Full display name from FN or N. Used as the dedupe key. */
  name: string;
  /** ISO YYYY-MM-DD. Year is `1904` when the vCard omitted it. */
  birthDate: string;
}

/**
 * Coerce a CalDAV server URL into the matching CardDAV root for the same
 * provider. Apple is the only common case that splits the two; everything
 * else passes through unchanged.
 */
export function deriveCardDAVUrl(serverUrl: string): string {
  return serverUrl.replace(/caldav\.icloud\.com/i, 'contacts.icloud.com');
}

/**
 * Fetch all birthdays (BDAY field) from every contact across every address
 * book on a CardDAV server. Returns one entry per (name, birthDate) pair —
 * contacts without a BDAY are skipped silently.
 */
export async function fetchCardDAVBirthdays(
  serverUrl: string,
  username: string,
  password: string,
): Promise<ContactBirthday[]> {
  const client = await createDAVClient({
    serverUrl: deriveCardDAVUrl(serverUrl),
    credentials: { username, password },
    authMethod: 'Basic',
    defaultAccountType: 'carddav',
  });

  const addressBooks = await client.fetchAddressBooks();
  const results: ContactBirthday[] = [];

  for (const book of addressBooks) {
    try {
      const vcards = await client.fetchVCards({ addressBook: book as DAVCollection });
      for (const obj of vcards) {
        const parsed = parseVCardBirthday(obj.data);
        if (parsed) results.push(parsed);
      }
    } catch (err) {
      console.error(
        `[carddav] failed to fetch from ${book.url}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return results;
}

/**
 * Extract a (name, birthDate) tuple from a single vCard, or null if the
 * card has no BDAY or no usable name. BDAY in vCard 3.0/4.0 commonly looks
 * like `1990-05-15`, `19900515`, or `--05-15` (year omitted).
 */
function parseVCardBirthday(data: string | undefined): ContactBirthday | null {
  if (!data) return null;

  try {
    const jcard = ICAL.parse(data);
    const comp = new ICAL.Component(jcard);
    const fn = comp.getFirstPropertyValue('fn');
    const bday = comp.getFirstPropertyValue('bday');
    if (!fn || !bday) return null;

    const name = String(fn).trim();
    if (!name) return null;

    const birthDate = normalizeBday(String(bday));
    if (!birthDate) return null;

    return { name, birthDate };
  } catch {
    return null;
  }
}

/**
 * Coerce the many BDAY shapes vCard allows into ISO `YYYY-MM-DD`. When the
 * year is missing we substitute 1904 — the same sentinel the Google birthday
 * sync writes, so the birthdays table can treat both sources uniformly.
 */
function normalizeBday(raw: string): string | null {
  const s = raw.trim();

  let year: string | null = null;
  let month: string | null = null;
  let day: string | null = null;

  // YYYY-MM-DD (vCard 4.0 + ical.js normalized form)
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) { year = m[1]!; month = m[2]!; day = m[3]!; }

  // YYYYMMDD (vCard 3.0 basic)
  if (!year) {
    m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (m) { year = m[1]!; month = m[2]!; day = m[3]!; }
  }

  // --MMDD or --MM-DD (vCard 4.0 explicit year-omitted form)
  if (!year) {
    m = s.match(/^--(\d{2})-?(\d{2})$/);
    if (m) { year = '1904'; month = m[1]!; day = m[2]!; }
  }

  // ISO datetime — strip the time portion
  if (!year) {
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})T/);
    if (m) { year = m[1]!; month = m[2]!; day = m[3]!; }
  }

  if (!year || !month || !day) return null;

  // Apple iCloud Contacts stores "no birth year given" as the literal year
  // 1604 in CardDAV vCards — a long-standing iOS idiosyncrasy rather than a
  // standard. Map it back to our year-omitted sentinel (1904) so the
  // birthdays widget treats it the same as Google Contacts' year-less rows
  // (no age displayed) instead of rendering "age 421".
  if (year === '1604') year = '1904';

  return `${year}-${month}-${day}`;
}
