import { todayKey, wallTimeAt, weekdayOfKey } from '@/lib/utils/zonedDate';

/**
 * Time-of-day rules for a named screen (#692): "weekdays 07:00-07:45, show
 * Morning". Outside every rule the screen shows its own dashboard.
 *
 * Stored as one of the screen's settings (see SCREEN_SETTING_KEYS), so it is
 * kept on the screen's row, edited from any device and picked up by the screen
 * like every other setting. The server reads it to open the right dashboard,
 * the screen reads it to change over while it is on.
 *
 * Times are the household's wall clock. A window whose end is not after its
 * start runs past midnight (22:00-06:00) and belongs to the day it starts on;
 * one whose start and end are equal lasts the whole day.
 */

export const SCREEN_SCHEDULE_KEY = 'prism-screen-schedule';

/** The React transition type a scheduled change over runs under (see CssGridDisplay). */
export const SCHEDULE_TRANSITION = 'screen-schedule';

/** Far more than a screen needs, and keeps the stored value under the setting length limit. */
export const MAX_SCHEDULE_RULES = 12;

export type ScheduleRule = {
  /** 0 = Sunday ... 6 = Saturday. */
  days: number[];
  /** `HH:mm`, inclusive. */
  from: string;
  /** `HH:mm`, exclusive. */
  to: string;
  dashboardId: string;
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function minutesOf(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
}

function cleanRule(raw: unknown): ScheduleRule | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.from !== 'string' || !HHMM.test(r.from)) return null;
  if (typeof r.to !== 'string' || !HHMM.test(r.to)) return null;
  if (typeof r.dashboardId !== 'string' || !r.dashboardId) return null;
  if (!Array.isArray(r.days)) return null;
  const days = [...new Set(r.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  if (days.length === 0) return null;
  return { days, from: r.from, to: r.to, dashboardId: r.dashboardId };
}

/** The rules in a stored value, in order. Anything unreadable is left out rather than failing the lot. */
export function parseSchedule(raw: string | null | undefined): ScheduleRule[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(cleanRule).filter((r): r is ScheduleRule => r !== null).slice(0, MAX_SCHEDULE_RULES);
  } catch {
    return [];
  }
}

/** The value to store, or null to unset the setting when there are no rules. */
export function serializeSchedule(rules: ScheduleRule[]): string | null {
  const clean = rules.map(cleanRule).filter((r): r is ScheduleRule => r !== null).slice(0, MAX_SCHEDULE_RULES);
  return clean.length > 0 ? JSON.stringify(clean) : null;
}

/** Whether `rule` covers a moment that is `minute` minutes into `weekday` on the wall clock. */
export function ruleCovers(rule: ScheduleRule, weekday: number, minute: number): boolean {
  const from = minutesOf(rule.from);
  const to = minutesOf(rule.to);
  if (from === to) return rule.days.includes(weekday);
  if (from < to) return rule.days.includes(weekday) && minute >= from && minute < to;
  // Past midnight: the evening part on the day itself, the morning part on the next.
  const yesterday = (weekday + 6) % 7;
  return (rule.days.includes(weekday) && minute >= from) || (rule.days.includes(yesterday) && minute < to);
}

export type ScheduledDashboard = {
  /** Index of the rule in force, or -1 when none is. */
  rule: number;
  /** The dashboard that rule shows, or null for the screen's own. */
  dashboardId: string | null;
};

/**
 * Which rule is in force at `now`: the first, in the stored order, whose
 * window covers it and whose dashboard still exists.
 */
export function scheduledDashboard(
  rules: ScheduleRule[],
  now: Date | number,
  timeZone: string,
  exists: (dashboardId: string) => boolean = () => true,
): ScheduledDashboard {
  const weekday = weekdayOfKey(todayKey(timeZone, now));
  const minute = minutesOf(wallTimeAt(timeZone, now));
  const index = rules.findIndex((r) => ruleCovers(r, weekday, minute) && exists(r.dashboardId));
  return index === -1 ? { rule: -1, dashboardId: null } : { rule: index, dashboardId: rules[index]!.dashboardId };
}

/**
 * The dashboard a named screen should be showing at `now`: the scheduled one
 * while a rule is in force, otherwise its own (null is the household default).
 */
export function screenDashboardAt(
  screen: { dashboardId: string | null; settings: Record<string, string> },
  now: Date | number,
  timeZone: string,
  exists: (dashboardId: string) => boolean = () => true,
): string | null {
  const rules = parseSchedule(screen.settings[SCREEN_SCHEDULE_KEY]);
  return scheduledDashboard(rules, now, timeZone, exists).dashboardId ?? screen.dashboardId;
}
