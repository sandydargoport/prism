/**
 * The event form's repeat builder (#59): a plain description of how an event
 * repeats, and the RFC 5545 RRULE it stands for.
 *
 * The description is kept relative to the event's start date. "Monthly on
 * the third Wednesday" is whichever weekday the start falls on, so moving the
 * start in the form moves the rule with it, as in Google Calendar. The RRULE
 * is built from the description and the start only when the event is saved.
 *
 * A rule the builder cannot show exactly (one made in another app, say
 * "the last weekday of the month") parses to null, and the form keeps that
 * rule as it is rather than rewriting it into something close.
 */

import { addDaysToKey, todayKey, weekdayOfKey, zonedWallTimeToUtc } from './zonedDate';

export type RepeatFreq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export type RepeatEnds =
  | { type: 'never' }
  | { type: 'count'; count: number }
  | { type: 'until'; date: string };

export type RepeatSpec = {
  freq: RepeatFreq;
  /** Every N days, weeks, months or years. */
  interval: number;
  /** Weekly: the days it repeats on, 0 = Sunday. */
  weekdays: number[];
  /** Monthly and yearly: on the start's date, or on its weekday ("third Wednesday"). */
  by: 'date' | 'weekday';
  ends: RepeatEnds;
};

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
const FREQS: readonly RepeatFreq[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];

function splitKey(dateKey: string): [number, number, number] {
  return dateKey.split('-').map(Number) as [number, number, number];
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Which weekday of its month a date is: `nth` 1 to 4, or -1 for a fifth one,
 * which only "last" describes. `isLast` says whether it is also the last.
 */
export function weekdayOfMonth(dateKey: string): { weekday: number; nth: number; isLast: boolean } {
  const [year, month, day] = splitKey(dateKey);
  const nth = Math.ceil(day / 7);
  return {
    weekday: weekdayOfKey(dateKey),
    nth: nth > 4 ? -1 : nth,
    isLast: day + 7 > daysInMonth(year, month),
  };
}

/** The builder's starting point for an event starting on `startKey`: weekly on its weekday. */
export function defaultRepeatSpec(startKey: string): RepeatSpec {
  return { freq: 'WEEKLY', interval: 1, weekdays: [weekdayOfKey(startKey)], by: 'date', ends: { type: 'never' } };
}

/**
 * UNTIL for the last day a series may fall on: that date for an all-day
 * event, and for a timed one the last second of that day in the household
 * zone, in UTC, as RFC 5545 requires when DTSTART has a time.
 */
function untilValue(dateKey: string, allDay: boolean, timeZone: string): string {
  if (allDay) return dateKey.replace(/-/g, '');
  const end = new Date(zonedWallTimeToUtc(addDaysToKey(dateKey, 1), '00:00', timeZone).getTime() - 1000);
  return end.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** The RRULE for a builder description and the event's start date. */
export function buildRepeatRule(spec: RepeatSpec, startKey: string, allDay: boolean, timeZone: string): string {
  const parts = [`FREQ=${spec.freq}`];
  if (spec.interval > 1) parts.push(`INTERVAL=${Math.floor(spec.interval)}`);

  const [, month, day] = splitKey(startKey);
  const { weekday, nth } = weekdayOfMonth(startKey);
  if (spec.freq === 'WEEKLY') {
    const days = spec.weekdays.length > 0 ? spec.weekdays : [weekday];
    // Monday first, the order RRULEs are usually written in.
    const ordered = [...new Set(days)].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    parts.push(`BYDAY=${ordered.map((i) => DAY_CODES[i]).join(',')}`);
  } else if (spec.freq === 'MONTHLY') {
    parts.push(spec.by === 'weekday' ? `BYDAY=${nth}${DAY_CODES[weekday]}` : `BYMONTHDAY=${day}`);
  } else if (spec.freq === 'YEARLY') {
    parts.push(`BYMONTH=${month}`);
    parts.push(spec.by === 'weekday' ? `BYDAY=${nth}${DAY_CODES[weekday]}` : `BYMONTHDAY=${day}`);
  }

  if (spec.ends.type === 'count') parts.push(`COUNT=${Math.max(1, Math.floor(spec.ends.count))}`);
  if (spec.ends.type === 'until') parts.push(`UNTIL=${untilValue(spec.ends.date, allDay, timeZone)}`);
  return parts.join(';');
}

/** The date key an UNTIL value names, read in the household zone when it is an instant. */
function untilDateKey(value: string, timeZone: string): string | null {
  const date = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (date) return `${date[1]}-${date[2]}-${date[3]}`;
  const time = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  if (!time) return null;
  const [, y, mo, d, h, mi, s] = time.map(Number) as number[];
  return todayKey(timeZone, Date.UTC(y!, mo! - 1, d!, h!, mi!, s!));
}

/**
 * The builder description of a stored rule for an event starting on
 * `startKey`, or null when the builder cannot show it exactly.
 */
export function parseRepeatRule(rule: string, startKey: string, timeZone: string): RepeatSpec | null {
  const fields = new Map<string, string>();
  for (const part of rule.trim().replace(/^RRULE:/i, '').split(';')) {
    if (!part) continue;
    const [key, value] = part.split('=');
    if (!key || value === undefined) return null;
    fields.set(key.toUpperCase(), value.toUpperCase());
  }

  const freq = fields.get('FREQ') as RepeatFreq | undefined;
  if (!freq || !FREQS.includes(freq)) return null;
  for (const key of fields.keys()) {
    if (!['FREQ', 'INTERVAL', 'BYDAY', 'BYMONTHDAY', 'BYMONTH', 'COUNT', 'UNTIL', 'WKST'].includes(key)) return null;
  }

  const interval = fields.has('INTERVAL') ? Number(fields.get('INTERVAL')) : 1;
  if (!Number.isInteger(interval) || interval < 1) return null;

  let ends: RepeatEnds = { type: 'never' };
  if (fields.has('COUNT') && fields.has('UNTIL')) return null;
  if (fields.has('COUNT')) {
    const count = Number(fields.get('COUNT'));
    if (!Number.isInteger(count) || count < 1) return null;
    ends = { type: 'count', count };
  }
  if (fields.has('UNTIL')) {
    const date = untilDateKey(fields.get('UNTIL')!, timeZone);
    if (!date) return null;
    ends = { type: 'until', date };
  }

  const [, month, day] = splitKey(startKey);
  const start = weekdayOfMonth(startKey);
  const byDay = fields.get('BYDAY');
  const byMonthDay = fields.get('BYMONTHDAY');
  const byMonth = fields.get('BYMONTH');
  // Weekdays default to the start's, which the day toggles show if someone
  // switches a monthly rule to weekly.
  const spec: RepeatSpec = { freq, interval, weekdays: [start.weekday], by: 'date', ends };

  // "On the start's weekday of the month": the nth one, or the last when the
  // start is the last of its month.
  const isStartWeekday = (value: string) => {
    const match = /^([+-]?\d)([A-Z]{2})$/.exec(value);
    if (!match || DAY_CODES.indexOf(match[2] as (typeof DAY_CODES)[number]) !== start.weekday) return false;
    const n = Number(match[1]);
    return n === start.nth || (n === -1 && start.isLast);
  };

  if (freq === 'DAILY') {
    if (byDay || byMonthDay || byMonth) return null;
  } else if (freq === 'WEEKLY') {
    if (byMonthDay || byMonth) return null;
    if (byDay) {
      const days = byDay.split(',').map((code) => DAY_CODES.indexOf(code as (typeof DAY_CODES)[number]));
      if (days.some((i) => i < 0)) return null;
      spec.weekdays = days;
    }
  } else {
    if (freq === 'YEARLY' && byMonth !== undefined && Number(byMonth) !== month) return null;
    if (freq === 'MONTHLY' && byMonth) return null;
    if (byDay) {
      if (byMonthDay || !isStartWeekday(byDay)) return null;
      if (freq === 'YEARLY' && byMonth === undefined) return null;
      spec.by = 'weekday';
    } else if (byMonthDay !== undefined && Number(byMonthDay) !== day) {
      return null;
    }
  }
  return spec;
}

/**
 * The first date on or after `startKey` that a weekly rule on `weekdays`
 * falls on, so an event set to repeat on Tuesdays and Thursdays but starting
 * on a Monday begins on the Tuesday instead of having a stray first date.
 */
export function firstRepeatDate(startKey: string, spec: RepeatSpec): string {
  if (spec.freq !== 'WEEKLY' || spec.weekdays.length === 0) return startKey;
  let key = startKey;
  for (let i = 0; i < 7 && !spec.weekdays.includes(weekdayOfKey(key)); i++) key = addDaysToKey(key, 1);
  return key;
}
