/**
 * Per-calendar display rules (#877), set on a calendar in Settings:
 * - busyOnly: its events show as "Busy", with no description or place. Done
 *   on the server, so the hidden text never reaches the screen.
 * - hideAfter: "HH:mm"; its events on today's date disappear from the screen
 *   after that time of day (bin day after 11am) and are back the next day.
 * - birthdays: a birthday event reads as the name and the age turned
 *   ("Emma, 9"), when Prism's birthday list has that name with a birth year.
 */

export interface DisplayRules {
  busyOnly?: boolean;
  hideAfter?: string;
  birthdays?: boolean;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Only the rules Prism knows, in the shapes it knows; anything else drops. */
export function parseDisplayRules(raw: unknown): DisplayRules | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const out: DisplayRules = {};
  if (r.busyOnly === true) out.busyOnly = true;
  if (typeof r.hideAfter === 'string' && HHMM.test(r.hideAfter)) out.hideAfter = r.hideAfter;
  if (r.birthdays === true) out.birthdays = true;
  return Object.keys(out).length > 0 ? out : null;
}

/** Years before this are not real birth years (synced ones without a year are 1904). */
const FIRST_REAL_YEAR = 1910;

/** The name in a birthday event's title, or null. */
export function birthdayName(title: string): string | null {
  const t = title.trim();
  const patterns = [
    /^(.+?)['’]s\s+birthday$/i,
    /^birthday\s*[:\-–]\s*(.+)$/i,
    /^(.+?)\s+birthday$/i,
    /^happy\s+birthday,?\s+(.+?)!?$/i,
  ];
  for (const p of patterns) {
    const m = t.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

/**
 * "Name, age" for a birthday event on `occursOn` (YYYY-MM-DD), when the name
 * is in the birthday list with a real birth year; otherwise the title as is.
 */
export function birthdayTitle(
  title: string,
  occursOn: string,
  birthdays: ReadonlyArray<{ name: string; birthDate: string }>,
): string {
  const name = birthdayName(title);
  if (!name) return title;
  const match = birthdays.find((b) => b.name.trim().toLowerCase() === name.toLowerCase());
  const year = match ? Number(String(match.birthDate).slice(0, 4)) : NaN;
  const eventYear = Number(occursOn.slice(0, 4));
  if (!match || !(year >= FIRST_REAL_YEAR) || year > eventYear) return title;
  return `${match.name.trim()}, ${eventYear - year}`;
}

/**
 * Whether an event is hidden now by its calendar's hideAfter: it falls on
 * today's date (in the given zone's wall clock, via `todayKey`/`minutes`) and
 * the time of day is past the rule.
 */
export function hiddenByTime(opts: {
  hideAfter: string | undefined;
  eventDayKeys: readonly string[];
  todayKey: string;
  nowMinutes: number;
}): boolean {
  if (!opts.hideAfter || !HHMM.test(opts.hideAfter)) return false;
  if (!opts.eventDayKeys.includes(opts.todayKey)) return false;
  const [h, m] = opts.hideAfter.split(':').map(Number);
  return opts.nowMinutes >= h! * 60 + m!;
}
