import { z } from 'zod';
import { todayKey, wallTimeAt, weekdayOfKey } from '@/lib/utils/zonedDate';
import { idleBackgroundSchema, parseIdleBackground, type IdleBackground } from '@/lib/idleBackground';

/**
 * Timelines (#1266): a named plan for a screen's day, kept on its own.
 *
 * A timeline says which dashboard shows when ("weekdays 7:00 to 7:45, Bus;
 * the rest of the day, Kitchen") and how the screen rests and what it does at
 * night. A screen picks one; two screens that should behave alike pick the
 * same one, so nothing is copied or kept in step. The household's first
 * timeline is the one every screen that has not picked another follows,
 * devices nobody named included.
 *
 * A placement puts a dashboard on some days at some hours. Times are the
 * household's wall clock. A placement whose end is not after its start runs
 * past midnight (22:00-06:00) and belongs to the day it starts on; one whose
 * start and end are equal lasts the whole day. When placements overlap, the
 * first in the stored order wins.
 *
 * Which dashboard shows is a named screen's: a device nobody named shows the
 * dashboard at its address and takes only its rest and night from here.
 */

/** The React transition type a scheduled change over runs under (see CssGridDisplay). */
export const SCHEDULE_TRANSITION = 'screen-schedule';

/** Far more than a day needs. */
export const MAX_PLACEMENTS = 24;

export const TIMELINE_NAME_MAX_LENGTH = 60;

/** What the household's first timeline is called. */
export const FIRST_TIMELINE_NAME = 'Main';

export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAYS = [1, 2, 3, 4, 5];
export const WEEKEND = [0, 6];

export type Placement = {
  /** 0 = Sunday ... 6 = Saturday. */
  days: number[];
  /** `HH:mm`, inclusive. */
  from: string;
  /** `HH:mm`, exclusive. */
  to: string;
  dashboardId: string;
};

export type Timeline = {
  id: string;
  name: string;
  position: number;
  /** The dashboard for the rest of the day; null is the household default. */
  dashboardId: string | null;
  placements: Placement[];
  /** How the screen rests and what it does at night. */
  idleBackground: IdleBackground;
  /** How many named screens follow it. */
  screens?: number;
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function minutesOf(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
}

function cleanPlacement(raw: unknown): Placement | null {
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

/** The placements in a stored value, in order. Anything unreadable is left out rather than failing the lot. */
export function parsePlacements(raw: unknown): Placement[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(cleanPlacement).filter((p): p is Placement => p !== null).slice(0, MAX_PLACEMENTS);
}

const placementSchema = z.object({
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  from: z.string().regex(HHMM),
  to: z.string().regex(HHMM),
  dashboardId: z.guid(),
});

/** A change to a timeline, as a request may send it. */
export const timelinePatchSchema = z.object({
  name: z.string().trim().min(1).max(TIMELINE_NAME_MAX_LENGTH).optional(),
  dashboardId: z.guid().nullable().optional(),
  placements: z.array(placementSchema).max(MAX_PLACEMENTS).optional(),
  idleBackground: idleBackgroundSchema.optional(),
}).strict();

export type TimelinePatch = z.infer<typeof timelinePatchSchema>;

/** A row as stored, made safe to use. */
export function toTimeline(row: {
  id: string; name: string; position: number; dashboardId: string | null; placements: unknown; idleBackground: unknown;
}, screens?: number): Timeline {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    dashboardId: row.dashboardId,
    placements: parsePlacements(row.placements),
    idleBackground: parseIdleBackground(row.idleBackground),
    ...(screens === undefined ? {} : { screens }),
  };
}

/** The household's first timeline: the lowest position, the oldest on a tie (the list comes ordered). */
export function firstTimeline<T extends { position: number }>(timelines: T[]): T | null {
  return timelines.reduce<T | null>((first, t) => (!first || t.position < first.position ? t : first), null);
}

/**
 * The timeline a screen follows: the one it picked, or the household's first
 * when it picked none, or picked one that has since been deleted.
 */
export function timelineFor<T extends { id: string; position: number }>(timelines: T[], timelineId: string | null | undefined): T | null {
  return (timelineId ? timelines.find((t) => t.id === timelineId) : undefined) ?? firstTimeline(timelines);
}

/**
 * A copy of `source` to start a new timeline from: the same plan, its own
 * placements, so a later edit to either leaves the other alone.
 */
export function duplicateOf(source: Pick<Timeline, 'dashboardId' | 'placements' | 'idleBackground'>, name: string): TimelinePatch & { name: string } {
  return {
    name,
    dashboardId: source.dashboardId,
    placements: source.placements.map((p) => ({ ...p, days: [...p.days] })),
    idleBackground: JSON.parse(JSON.stringify(source.idleBackground)) as IdleBackground,
  };
}

/** The name a duplicate gets: "Main copy", then "Main copy 2". */
export function copyName(name: string, taken: string[]): string {
  const base = `${name} copy`.slice(0, TIMELINE_NAME_MAX_LENGTH);
  if (!taken.includes(base)) return base;
  for (let n = 2; ; n++) {
    const next = `${base.slice(0, TIMELINE_NAME_MAX_LENGTH - String(n).length - 1)} ${n}`;
    if (!taken.includes(next)) return next;
  }
}

/** Whether `p` covers a moment that is `minute` minutes into `weekday` on the wall clock. */
export function placementCovers(p: Placement, weekday: number, minute: number): boolean {
  const from = minutesOf(p.from);
  const to = minutesOf(p.to);
  if (from === to) return p.days.includes(weekday);
  if (from < to) return p.days.includes(weekday) && minute >= from && minute < to;
  // Past midnight: the evening part on the day itself, the morning part on the next.
  const yesterday = (weekday + 6) % 7;
  return (p.days.includes(weekday) && minute >= from) || (p.days.includes(yesterday) && minute < to);
}

export type Placed = {
  /** Index of the placement in force, or -1 when none is. */
  index: number;
  /** The dashboard it shows, or null outside every placement. */
  dashboardId: string | null;
};

/**
 * Which placement is in force at `now`: the first, in the stored order, whose
 * hours cover it and whose dashboard still exists.
 */
export function placementAt(
  placements: Placement[],
  now: Date | number,
  timeZone: string,
  exists: (dashboardId: string) => boolean = () => true,
): Placed {
  const weekday = weekdayOfKey(todayKey(timeZone, now));
  const minute = minutesOf(wallTimeAt(timeZone, now));
  const index = placements.findIndex((p) => placementCovers(p, weekday, minute) && exists(p.dashboardId));
  return index === -1 ? { index: -1, dashboardId: null } : { index, dashboardId: placements[index]!.dashboardId };
}

/**
 * The dashboard a timeline shows at `now`: the placed one while a placement
 * is in force, otherwise the one for the rest of the day (null is the
 * household default, as is a dashboard that no longer exists).
 */
export function timelineDashboardAt(
  timeline: Pick<Timeline, 'dashboardId' | 'placements'>,
  now: Date | number,
  timeZone: string,
  exists: (dashboardId: string) => boolean = () => true,
): string | null {
  const placed = placementAt(timeline.placements, now, timeZone, exists).dashboardId;
  if (placed) return placed;
  return timeline.dashboardId && exists(timeline.dashboardId) ? timeline.dashboardId : null;
}

/** Whether a timeline ever shows `dashboard`, for the rest of the day or in a placement. */
export function timelineShows(
  timeline: Pick<Timeline, 'dashboardId' | 'placements'>,
  dashboard: { id: string; isDefault: boolean },
): boolean {
  if (timeline.dashboardId === dashboard.id || (timeline.dashboardId === null && dashboard.isDefault)) return true;
  return timeline.placements.some((p) => p.dashboardId === dashboard.id);
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** A set of days in words: "Every day", "Weekdays", "Weekend", "Mon, Wed". */
export function daysInWords(days: number[]): string {
  const set = [...new Set(days)].sort().join(',');
  if (set === EVERY_DAY.join(',')) return 'Every day';
  if (set === WEEKDAYS.join(',')) return 'Weekdays';
  if (set === WEEKEND.join(',')) return 'Weekend';
  return [...new Set(days)].sort().map((d) => DAY_NAMES[d]).join(', ');
}
