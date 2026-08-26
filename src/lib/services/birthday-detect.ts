/**
 * Source-agnostic birthday & milestone detection.
 *
 * Replaces the old Google-only scan, which read two hardcoded calendars: the
 * Google Contacts birthday calendar, and any source whose name happened to
 * contain "friends". That worked for whoever kept a calendar with that name
 * and for nobody else, and it was invisible — the magic string appeared in no
 * docs, no UI, and no Help section (discussion #292).
 *
 * This reads the normalised `events` table instead, which every provider
 * writes to (google, ical, caldav, local), so a birthday is found wherever the
 * user keeps it — including on their own local calendar, which is what makes
 * "add a birthday" answerable without a data-entry form.
 *
 * Precision comes from three cheap filters rather than from the calendar's
 * name. Measured against a real 2,216-event database:
 *
 *   - `allDay` — a real birthday is an all-day event; "dinner for Sam's
 *     birthday" is not. Deliberately NOT also requiring `recurring`: local
 *     events can never be recurring until the RRULE builder lands (#59), and
 *     requiring it would exclude exactly the calendars this change exists for.
 *   - writable sources only — subscribed/read-only calendars are where
 *     "No School~Dr. Martin Luther King's Birthday" and holiday feeds live.
 *   - negative keywords — catches "Prep for Ana's birthday (party)" on a
 *     calendar that is otherwise legitimate.
 *
 * Milestones have no keyword to match — the old code inferred them purely from
 * calendar membership, which is what forced the magic calendar name. They are
 * instead detected by shape: an all-day RECURRING event carrying a 4-digit
 * year and no other keyword, e.g. "Ana ❤️ Ben (2005)" or "CJT ❤️ MRT (1977)".
 * On real data that pattern matched 6 events, all genuine, against 107 all-day
 * non-keyword events overall — the year plus the annual repeat is what
 * separates a commemoration from an ordinary all-day entry.
 *
 * `recurring` is required HERE and nowhere else. A birthday can be a one-off
 * row on a local calendar and still obviously be a birthday, because the word
 * says so; a milestone has only its shape to go on, so the annual repeat is
 * carrying the meaning. The trade-off is that a hand-entered local milestone
 * isn't detected until the RRULE builder lands (#59) — acceptable, since
 * birthdays and anniversaries are the overwhelming majority.
 *
 * LIFE_EVENTS_CALENDAR_KEY remains as an optional per-source override for
 * anyone who keeps a dedicated calendar, but nothing requires it any more.
 */

import { db } from '@/lib/db/client';
import { birthdays, calendarSources, dismissedBirthdays, events } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { upsertBirthday } from './birthday-merge';
import { invalidateEntity } from '@/lib/cache/cacheKeys';

/** providerConfig flag marking a calendar as "everything all-day here is a life event". */
export const LIFE_EVENTS_CALENDAR_KEY = 'lifeEventsCalendar';

/**
 * Keywords are matched per language, not just in English. Prism ships a German
 * UI, and a household running it writes "Omas Geburtstag" on the calendar — an
 * English-only matcher would silently detect nothing at all for them, which is
 * worse than the magic-calendar-name problem this replaces because it fails
 * invisibly.
 *
 * German is here because it ships today. Adding a language is one entry, and
 * needs no code change beyond this table.
 */
const BIRTHDAY_KEYWORD = /geburtstag|birthday/i;
const ANNIVERSARY_KEYWORD = /(hochzeits|jahres)tag|jubiläum|anniversary/i;

/**
 * Titles that mention a life event but describe something happening NEAR it —
 * "Prep for Ana's birthday (party)" is not Ana's birthday.
 *
 * `\b` is unreliable next to non-ASCII, so these are matched loosely; a
 * substring hit is good enough for a veto list.
 */
const NEGATIVE_KEYWORDS = new RegExp(
  [
    // English
    'prep', 'party', 'dinner', 'lunch', 'brunch', 'bbq', 'sleepover', 'celebrat', 'no school',
    // German
    'feier', 'vorbereitung', 'abendessen', 'mittagessen', 'schulfrei', 'kein unterricht',
  ].join('|'),
  'i',
);

/**
 * A 4-digit year in the title. With an annual repeat this is the milestone
 * signal — "Ana ❤️ Ben (2005)" commemorates a year, "Bin day" does not.
 */
const YEAR_IN_TITLE = /\b(19\d{2}|20\d{2})\b/;

export type EventType = 'birthday' | 'anniversary' | 'milestone';

export interface ParsedEvent {
  name: string;
  eventType: EventType;
  /** YYYY-MM-DD taken from the event's own date. */
  birthDate: string;
  /** Birth/start year if one could be found, else null. */
  year: number | null;
}

export interface DetectResult {
  added: number;
  updated: number;
  /** Candidate events considered (before dedup). */
  total: number;
  errors: string[];
}

/**
 * Parse an event title into a life-event record. Lifted unchanged in substance
 * from the old Google-only sync route: the name-stripping and year extraction
 * were always correct, only the source of the events was wrong.
 *
 * `isLifeEventsCalendar` relaxes the keyword requirement — on a calendar the
 * user has explicitly designated, an all-day event with neither keyword is a
 * milestone rather than something to ignore.
 */
export function parseEventTitle(
  title: string,
  eventDate: string,
  description: string | null,
  isLifeEventsCalendar: boolean,
  isRecurring = false,
): ParsedEvent | null {
  if (!title.trim()) return null;

  const isBirthday = BIRTHDAY_KEYWORD.test(title);
  const isAnniversary = ANNIVERSARY_KEYWORD.test(title);
  // A commemoration with no keyword: annually repeating and naming its year.
  const looksLikeMilestone = isRecurring && YEAR_IN_TITLE.test(title);

  if (!isBirthday && !isAnniversary && !looksLikeMilestone && !isLifeEventsCalendar) {
    return null;
  }

  // "Prep for Ana's birthday (party)" is about a birthday, not one. A
  // designated calendar is exempt: the user vouched for its contents.
  if (!isLifeEventsCalendar && NEGATIVE_KEYWORDS.test(title)) return null;

  let eventType: EventType = 'milestone';
  let name = title;

  if (isBirthday) {
    eventType = 'birthday';
    name = title
      .replace(/['’]s\s+birthday/i, '')
      .replace(/\s*-\s*birthday/i, '')
      .replace(/birthday\s*-?\s*/i, '')
      // German: "Omas Geburtstag" -> "Omas". The genitive -s is deliberately
      // left on: German doesn't use an apostrophe, so "Lukas" is both a name
      // and a genitive form, and stripping it would mangle real names.
      .replace(/\s*-\s*geburtstag/i, '')
      .replace(/geburtstag\s*-?\s*/i, '')
      .trim();
  } else if (isAnniversary) {
    eventType = 'anniversary';
    name = title
      .replace(/['’]s\s+anniversary/i, '')
      .replace(/\s*-\s*anniversary/i, '')
      .replace(/anniversary\s*-?\s*/i, '')
      .replace(/(hochzeits|jahres)tag\s*-?\s*/i, '')
      .replace(/jubiläum\s*-?\s*/i, '')
      .trim();
  }

  // A 4-digit year may live in the title or the description.
  let year: number | null = null;
  const yearMatch = `${title} ${description || ''}`.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) year = parseInt(yearMatch[1]!, 10);

  name = name
    .replace(/\s*\(\d{4}\)\s*/g, ' ')   // drop "(1993)"
    .replace(/['’]s?\s*$/, '')          // drop a trailing possessive
    .replace(/[!?.]+\s*$/, '')          // drop trailing punctuation: "Halvorsen's Birthday!"
    .replace(/\s+/g, ' ')
    .trim();
  if (!name) name = title;

  return { name, eventType, birthDate: eventDate, year };
}

/** Matches normalize() in birthday-merge.ts so tombstones line up with merges. */
function normalizeName(s: string): string {
  return s.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Scan every enabled calendar for life events and upsert them.
 *
 * Returns net changes rather than rows considered, matching the calendar-event
 * sync's reporting.
 */
export async function detectBirthdaysFromEvents(): Promise<DetectResult> {
  const result: DetectResult = { added: 0, updated: 0, total: 0, errors: [] };

  // All-day events on enabled sources. Writable-only (showInEventModal) keeps
  // subscribed holiday/school feeds out; a designated life-events calendar
  // overrides that, since the user opted it in explicitly.
  const rows = await db
    .select({
      title: events.title,
      description: events.description,
      startTime: events.startTime,
      recurring: events.recurring,
      sourceName: calendarSources.dashboardCalendarName,
      providerConfig: calendarSources.providerConfig,
      showInEventModal: calendarSources.showInEventModal,
    })
    .from(events)
    .innerJoin(calendarSources, eq(events.calendarSourceId, calendarSources.id))
    .where(and(eq(events.allDay, true), eq(calendarSources.enabled, true)));

  const tombstones = await db.select().from(dismissedBirthdays);
  const isDismissed = (name: string, month: number, day: number, type: string) =>
    tombstones.some(
      (t) =>
        t.normalizedName === normalizeName(name) &&
        t.birthMonth === month &&
        t.birthDay === day &&
        t.eventType === type,
    );

  for (const row of rows) {
    const cfg = (row.providerConfig as Record<string, unknown> | null) ?? {};
    const isLifeEvents = cfg[LIFE_EVENTS_CALENDAR_KEY] === true;
    if (!row.showInEventModal && !isLifeEvents) continue;

    const parsed = parseEventTitle(
      row.title,
      isoDate(row.startTime),
      row.description,
      isLifeEvents,
      row.recurring,
    );
    if (!parsed) continue;

    result.total++;

    const [, month, day] = parsed.birthDate.split('-');
    if (!month || !day) continue;
    const birthDate = `${parsed.year ?? 1904}-${month}-${day}`;

    if (isDismissed(parsed.name, parseInt(month, 10), parseInt(day, 10), parsed.eventType)) continue;

    try {
      const outcome = await upsertBirthday({
        name: parsed.name,
        birthDate,
        eventType: parsed.eventType,
        source: row.sourceName || 'calendar',
      });
      if (outcome === 'inserted') result.added++;
      else if (outcome === 'updated') result.updated++;
    } catch (err) {
      console.error('[BirthdayDetect] upsert failed:', parsed.name, err);
      result.errors.push(`Failed to upsert ${parsed.name}: ${err}`);
    }
  }

  if (result.added + result.updated > 0) await invalidateEntity('birthdays');
  return result;
}

/** All-day events are stored as floating dates; take the calendar day as-is. */
function isoDate(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

/** Record a tombstone so a deleted birthday isn't re-detected next sync. */
export async function dismissBirthday(row: {
  name: string;
  birthDate: string;
  eventType: string;
}): Promise<void> {
  const [, mo, dy] = row.birthDate.split('-');
  if (!mo || !dy) return;
  await db
    .insert(dismissedBirthdays)
    .values({
      normalizedName: normalizeName(row.name).slice(0, 100),
      birthMonth: parseInt(mo, 10),
      birthDay: parseInt(dy, 10),
      eventType: row.eventType,
    })
    .onConflictDoNothing();
}

export { birthdays };
