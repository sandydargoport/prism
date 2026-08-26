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
 *
 * Hand-entered rows (googleCalendarSource IS NULL) are authoritative and a
 * sync must not rewrite them. Detection now scans every calendar rather than
 * two curated ones, so a same-day near-name collision with something the user
 * typed themselves went from unlikely to routine — and silently renaming or
 * re-dating their row, then stamping it as "synced", is not recoverable.
 * The only change ever applied to such a row is filling in a real year over
 * the 1904 unknown-year sentinel.
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

/** Null provenance = the user typed this in. Schema comment: "Null = manually created". */
function isHandEntered(row: { googleCalendarSource: string | null }): boolean {
  return row.googleCalendarSource === null;
}

/**
 * Fill in a real year over the 1904 sentinel, leaving everything else alone.
 * The only mutation a sync may apply to a hand-entered row.
 */
async function upgradeSentinelYear(
  existing: { id: string; birthDate: string },
  newYear: number,
  mo: string,
  dy: string,
): Promise<'updated' | 'skipped'> {
  if (parseYear(existing.birthDate) !== 1904 || newYear === 1904) return 'skipped';
  await db.update(birthdays)
    .set({ birthDate: `${newYear}-${mo}-${dy}` })
    .where(eq(birthdays.id, existing.id));
  return 'updated';
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
    // A row the user typed is authoritative: never rename it, never re-date it,
    // and never stamp it with sync provenance. Only fill in a missing year.
    if (
      isHandEntered(existing) &&
      (normalize(existing.name) === normalize(name) ||
        isTokenPrefix(existing.name, name) ||
        isTokenPrefix(name, existing.name))
    ) {
      return upgradeSentinelYear(existing, newYear, mo, dy);
    }

    // Exact match: standard upsert behavior — refresh fields, keep id.
    if (normalize(existing.name) === normalize(name)) {
      // Prefer a known year over the 1904 unknown-year sentinel, so the Google
      // sync (often has the year) and the CardDAV sync (often 1904) don't
      // overwrite each other's date on every run.
      const existingYear = parseYear(existing.birthDate);
      const keepYear = existingYear !== 1904 ? existingYear : newYear;
      const mergedDate = `${keepYear}-${mo}-${dy}`;
      // Only a genuine change to the (year-preferring) date counts. The source
      // is provenance and legitimately flip-flops between the two birthday
      // syncs, so a source-only difference must NOT count as an update.
      if (existing.birthDate === mergedDate) {
        return 'skipped';
      }
      await db.update(birthdays).set({
        birthDate: mergedDate,
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
