/**
 * Cross-source birthday dedup. Same person commonly arrives twice — once
 * from a Google Calendar event titled "Alex's birthday" (regex-parsed,
 * carries just the first name) and once from a vCard with FN "Alex Doe"
 * (CardDAV sync, carries the full name). The (name, eventType) unique index
 * doesn't catch these because the names differ.
 *
 * The heuristic that doesn't false-positive across distinct people:
 *   - same birth month + day
 *   - one name is a TOKEN-PREFIX of the other (e.g. "Alex" ⊂ "Alex Doe"
 *     but "Jordan Doe" ⊄ "Jordan Smith" — two distinct contacts who
 *     happen to share a birth day)
 *
 * When that holds, we keep the longer name and prefer the non-1904 year
 * (1904 is the year-omitted sentinel from CardDAV / Google Contacts).
 *
 * Sharing first name + birthday but with two distinct last names is
 * (deliberately) NOT auto-merged — that's the false-positive case.
 */

import { db } from '@/lib/db/client';
import { birthdays } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';

interface UpsertOpts {
  name: string;
  birthDate: string;       // YYYY-MM-DD
  eventType?: 'birthday' | 'anniversary' | 'milestone';
  source: string;          // e.g. 'birthdays', 'friends_family', 'caldav_contacts'
}

/** Strip punctuation, collapse whitespace, lowercase. */
function normalize(s: string): string {
  return s.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Token-prefix: "alex" is prefix of "alex doe", "jordan doe" is NOT prefix of "jordan smith". */
function isTokenPrefix(short: string, long: string): boolean {
  const a = normalize(short).split(' ');
  const b = normalize(long).split(' ');
  if (a.length > b.length) return false;
  return a.every((tok, i) => tok === b[i]);
}

function parseYear(birthDate: string): number {
  return parseInt(birthDate.split('-')[0]!, 10);
}

/**
 * Insert a birthday, but merge with any existing prefix-match candidate
 * sharing the same month/day. Returns the action taken so callers can
 * count synced vs deduped rows.
 */
export async function upsertBirthday(opts: UpsertOpts): Promise<'inserted' | 'updated' | 'skipped'> {
  const { name, birthDate, source } = opts;
  const eventType = opts.eventType ?? 'birthday';
  const [yearStr, mo, dy] = birthDate.split('-');
  if (!mo || !dy || !yearStr) return 'skipped';
  const newYear = parseInt(yearStr, 10);

  const candidates = await db.query.birthdays.findMany({
    where: and(
      eq(birthdays.eventType, eventType),
      sql`EXTRACT(MONTH FROM ${birthdays.birthDate}) = ${parseInt(mo, 10)}`,
      sql`EXTRACT(DAY FROM ${birthdays.birthDate}) = ${parseInt(dy, 10)}`,
    ),
  });

  for (const existing of candidates) {
    // Exact match: standard upsert behavior — refresh fields, keep id.
    if (normalize(existing.name) === normalize(name)) {
      await db.update(birthdays).set({
        birthDate,
        googleCalendarSource: source,
      }).where(eq(birthdays.id, existing.id));
      return 'updated';
    }

    // Existing is the shorter prefix → promote it to the longer name.
    if (isTokenPrefix(existing.name, name)) {
      const existingYear = parseYear(existing.birthDate);
      const keepYear = existingYear !== 1904 ? existingYear : newYear;
      await db.update(birthdays).set({
        name,
        birthDate: `${keepYear}-${mo}-${dy}`,
        googleCalendarSource: source,
      }).where(eq(birthdays.id, existing.id));
      return 'updated';
    }

    // New is the shorter prefix → keep existing, optionally improve its year.
    if (isTokenPrefix(name, existing.name)) {
      const existingYear = parseYear(existing.birthDate);
      if (existingYear === 1904 && newYear !== 1904) {
        await db.update(birthdays).set({
          birthDate: `${newYear}-${mo}-${dy}`,
        }).where(eq(birthdays.id, existing.id));
        return 'updated';
      }
      return 'skipped';
    }

    // Same first name but neither name is a prefix of the other — different
    // people. Continue to the next candidate.
  }

  // No prefix-match. Use the existing (name, eventType) unique index
  // for the standard upsert path.
  await db.insert(birthdays).values({
    name,
    birthDate,
    eventType,
    googleCalendarSource: source,
  }).onConflictDoUpdate({
    target: [birthdays.name, birthdays.eventType],
    set: { birthDate, googleCalendarSource: source },
  });
  return 'inserted';
}
