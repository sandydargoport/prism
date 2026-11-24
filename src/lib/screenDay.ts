import { z } from 'zod';
import { IDLE_SOURCES, MAX_OFFSET_MINUTES, sameIdleBackground, type IdleBackground } from './idleBackground';
import { asDayAndNight, DEFAULT_NIGHT } from './throughTheDay';

/**
 * The screen owns its day (#1345): what it shows idle by day and at night,
 * when night is, and how much darker it goes at night.
 *
 * Kept in one screen setting key, so it syncs with the screen's row, is
 * edited from another device and stays per browser on a device with no name,
 * like every other screen setting (see displays/screenSettings). The value is
 * the JSON text of a `ScreenDay`.
 *
 * Before, the looks and the rule were on the dashboard that was up, so a
 * switch to another dashboard changed how the screen idled, and how much
 * darker was a key of its own. Migration 0057 moved both here.
 *
 * The household keeps a starting day in one `settings` row. A screen named
 * from a browser copies the day that browser has, once, and then holds its
 * own; a browser with no name uses the household's until it sets its own.
 */

/** The screen setting key that holds the day. */
export const SCREEN_DAY_KEY = 'prism-screen-day';

/** The `settings` row that holds the household's starting day. */
export const HOUSEHOLD_DAY_SETTING = 'screenStartingDay';

/** The screen key how much darker lived in before 0057; still read on a browser with no day of its own. */
export const LEGACY_DIM_KEY = 'prism-screensaver-dim';

/** How much darker at night, in percent. */
export const NIGHT_LEVELS = [0, 25, 50, 75] as const;
export type NightLevel = (typeof NIGHT_LEVELS)[number];

/** What a new install starts at night: 50% darker (written by the database seed). */
export const NEW_INSTALL_NIGHT_LEVEL: NightLevel = 50;

const source = z.enum(IDLE_SOURCES);
const offset = z.number().int().min(-MAX_OFFSET_MINUTES).max(MAX_OFFSET_MINUTES);
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const rule = z.union([
  z.object({ by: z.literal('sun'), duskOffset: offset, dawnOffset: offset }).strict(),
  z.object({ by: z.literal('clock'), from: clockTime, to: clockTime }).strict()
    .refine((s) => s.from !== s.to, 'Night must start and end at different times'),
]);

export const screenDaySchema = z.object({
  day: source,
  night: source,
  switch: rule,
  // Missing is not darker: the code default stays 0, so a screen that never
  // set a level keeps what it had.
  nightLevel: z.union([z.literal(0), z.literal(25), z.literal(50), z.literal(75)]).optional(),
}).strict();

export type ScreenDay = {
  day: z.infer<typeof source>;
  night: z.infer<typeof source>;
  switch: z.infer<typeof rule>;
  nightLevel: NightLevel;
};

/**
 * The day with nothing stored anywhere: the dashboard quieter by day and at
 * night, the default night rule, not darker. The look is what the database
 * gives a dashboard (`layouts.idle_background` defaults to the dashboard),
 * so the client and the database agree.
 */
export const DEFAULT_SCREEN_DAY: ScreenDay = {
  day: 'dashboard',
  night: 'dashboard',
  switch: DEFAULT_NIGHT,
  nightLevel: 0,
};

function fromParsed(value: unknown): ScreenDay | null {
  const parsed = screenDaySchema.safeParse(value);
  if (!parsed.success) return null;
  const { nightLevel = 0, ...rest } = parsed.data;
  return { ...rest, nightLevel };
}

/** A stored day key, or null when there is none or it is not one we know. */
export function parseScreenDay(raw: string | null | undefined): ScreenDay | null {
  if (!raw) return null;
  try {
    return fromParsed(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** The household's starting day from its settings row, or the default when it is missing or unknown. */
export function parseHouseholdDay(value: unknown): ScreenDay {
  return fromParsed(value) ?? DEFAULT_SCREEN_DAY;
}

/** The day as the key stores it, keys always in the same order. */
export function serializeScreenDay(day: ScreenDay): string {
  return JSON.stringify({ day: day.day, night: day.night, switch: day.switch, nightLevel: day.nightLevel });
}

/** The level an old `prism-screensaver-dim` value means, or null for none. */
export function levelFromDim(raw: string | null | undefined): NightLevel | null {
  switch (raw) {
    case '0': return 0;
    case '0.25': return 25;
    case '0.5': return 50;
    case '0.75': return 75;
    default: return null;
  }
}

/**
 * The day a browser goes by: its own key; with none, the household's, with
 * the browser's old dim value if it has one, so a browser nobody named keeps
 * how dark it was.
 */
export function effectiveScreenDay(own: string | null, household: ScreenDay, legacyDim: string | null): ScreenDay {
  const mine = parseScreenDay(own);
  if (mine) return mine;
  const level = levelFromDim(legacyDim);
  return level === null ? household : { ...household, nightLevel: level };
}

/**
 * The looks and the rule as the idle code reads them: one look all the time
 * when it is the same by day and at night on the default rule, as a dashboard
 * nobody set a night for was stored.
 */
export function backgroundOf(day: ScreenDay): IdleBackground {
  const pair: IdleBackground = { day: day.day, night: day.night, switch: day.switch };
  if (day.day === day.night && sameIdleBackground(pair, { day: day.day, night: day.day, switch: DEFAULT_NIGHT })) {
    return { source: day.day };
  }
  return pair;
}

/** The day with its looks and rule set from `bg`, its level kept. */
export function withBackground(day: ScreenDay, bg: IdleBackground): ScreenDay {
  const pair = asDayAndNight(bg);
  return { day: pair.day, night: pair.night, switch: pair.switch, nightLevel: day.nightLevel };
}

/** How much darker as the opacity of the black drawn over the screen. */
export function nightOpacity(day: ScreenDay): number {
  return day.nightLevel / 100;
}
