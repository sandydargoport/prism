/**
 * A newly named screen copies its day once (#1345).
 *
 * The first time a browser syncs with a screen that has nothing stored, what
 * the browser has becomes the screen's settings (see the settings route). Its
 * day is written then as well, so the screen holds its own from the start:
 * the browser's own day if it set one, otherwise the day it was going by,
 * which is the household's starting day with the browser's old dim value if
 * it had one. On a new install the household's day is 50% darker at night,
 * so new screens are too; a screen that never had a level reads as not darker.
 */
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import {
  HOUSEHOLD_DAY_SETTING,
  LEGACY_DIM_KEY,
  levelFromDim,
  parseHouseholdDay,
  parseScreenDay,
  SCREEN_DAY_KEY,
  serializeScreenDay,
  type ScreenDay,
} from '@/lib/screenDay';
import type { ScreenSettingChanges } from './screenSettings';

/** The household's starting day, from its settings row; the default when there is none. */
export async function readHouseholdDay(): Promise<ScreenDay> {
  const [row] = await db.select().from(settings).where(eq(settings.key, HOUSEHOLD_DAY_SETTING)).limit(1);
  return parseHouseholdDay(row?.value);
}

/**
 * A new screen's first settings: the browser's, with its day written out and
 * the old dim value folded into it.
 */
export function withStartingDay(changes: ScreenSettingChanges, household: ScreenDay): ScreenSettingChanges {
  const { [LEGACY_DIM_KEY]: dim, ...rest } = changes;
  if (parseScreenDay(rest[SCREEN_DAY_KEY] ?? null)) return rest;
  const level = levelFromDim(dim ?? null);
  const day = level === null ? household : { ...household, nightLevel: level };
  return { ...rest, [SCREEN_DAY_KEY]: serializeScreenDay(day) };
}
