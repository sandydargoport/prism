/**
 * A VTIMEZONE for an IANA zone, so a repeating event written to a CalDAV
 * server can say which zone its wall time is in (#59).
 *
 * A repeating event has to be written in a zone (DTSTART;TZID=...): in UTC a
 * weekly 9:00 would drift an hour at each clock change. RFC 5545 asks for the
 * zone's definition alongside, and nothing in the runtime holds the tz
 * database's rules, so they are read back from Intl: the year's clock changes
 * are found by their offsets, and each becomes a yearly rule on the nth (or
 * last) weekday of its month, the shape almost every zone with clock changes
 * uses. Servers and clients that know the zone by name use their own copy.
 */

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

const formatters = new Map<string, Intl.DateTimeFormat>();

/** The zone's UTC offset at an instant, in minutes (Chicago in winter: -360). */
function offsetMinutes(instant: number, timeZone: string): number {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
    });
    formatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return Math.round((wall - Math.floor(instant / 1000) * 1000) / MINUTE_MS);
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

/** "-0600" for -360 minutes. */
function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`;
}

type Transition = { at: number; from: number; to: number };

/** The instants in `year` at which the zone's offset changes. */
function transitionsIn(year: number, timeZone: string): Transition[] {
  const out: Transition[] = [];
  let t = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  let offset = offsetMinutes(t, timeZone);
  for (; t < end; t += DAY_MS) {
    const next = offsetMinutes(t + DAY_MS, timeZone);
    if (next === offset) continue;
    // Narrow the change down to the minute.
    let lo = t;
    let hi = t + DAY_MS;
    while (hi - lo > MINUTE_MS) {
      const mid = lo + Math.floor((hi - lo) / 2 / MINUTE_MS) * MINUTE_MS;
      if (offsetMinutes(mid, timeZone) === offset) lo = mid; else hi = mid;
    }
    out.push({ at: hi, from: offset, to: next });
    offset = next;
  }
  return out;
}

/** The date of the nth (or last, -1) `weekday` of a month. */
function nthWeekdayOfMonth(year: number, month: number, nth: number, weekday: number): number {
  if (nth > 0) {
    const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    return 1 + ((weekday - first + 7) % 7) + (nth - 1) * 7;
  }
  const lastDay = new Date(Date.UTC(year, month, 0));
  return lastDay.getUTCDate() - ((lastDay.getUTCDay() - weekday + 7) % 7);
}

/** One STANDARD or DAYLIGHT block for a yearly clock change. */
function ruleBlock(change: Transition, year: number): string[] {
  // The change as the clock read it just before: 02:00 for a US spring change.
  const wall = new Date(change.at + change.from * MINUTE_MS);
  const month = wall.getUTCMonth() + 1;
  const day = wall.getUTCDate();
  const weekday = wall.getUTCDay();
  const daysInMonth = new Date(Date.UTC(wall.getUTCFullYear(), month, 0)).getUTCDate();
  const nth = day + 7 > daysInMonth ? -1 : Math.ceil(day / 7);
  // Start the rule the year before, so it covers the whole first year.
  const firstDay = nthWeekdayOfMonth(year - 1, month, nth, weekday);
  const kind = change.to > change.from ? 'DAYLIGHT' : 'STANDARD';
  return [
    `BEGIN:${kind}`,
    `DTSTART:${pad(year - 1, 4)}${pad(month)}${pad(firstDay)}T${pad(wall.getUTCHours())}${pad(wall.getUTCMinutes())}00`,
    `TZOFFSETFROM:${formatOffset(change.from)}`,
    `TZOFFSETTO:${formatOffset(change.to)}`,
    `RRULE:FREQ=YEARLY;BYMONTH=${month};BYDAY=${nth}${DAY_CODES[weekday]}`,
    `END:${kind}`,
  ];
}

/** The VTIMEZONE text for `timeZone`, with the clock-change rules in force in `year`. */
export function buildVTimezone(timeZone: string, year: number): string {
  const changes = transitionsIn(year, timeZone);
  const lines = ['BEGIN:VTIMEZONE', `TZID:${timeZone}`];
  if (changes.length === 0) {
    const offset = formatOffset(offsetMinutes(Date.UTC(year, 0, 1), timeZone));
    lines.push('BEGIN:STANDARD', 'DTSTART:19700101T000000', `TZOFFSETFROM:${offset}`, `TZOFFSETTO:${offset}`, 'END:STANDARD');
  } else {
    for (const change of changes) lines.push(...ruleBlock(change, year));
  }
  lines.push('END:VTIMEZONE');
  return lines.join('\r\n');
}
