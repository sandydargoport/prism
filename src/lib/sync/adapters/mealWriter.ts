/**
 * Provider-agnostic meal persistence shared by the Tandoor and Mealie meal-plan
 * adapters. Both map their source into a NormalizedMeal and write to the same
 * `meals` table (tagged by `source`), so fingerprinting, local-load, row-write,
 * and delete live here once. Recipe auto-import stays provider-specific.
 *
 * NOTE: local meals are matched by their `source` tag ('tandoor' | 'mealie'),
 * which assumes one connection per provider.
 */

import { and, eq, gte, isNotNull, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { meals, recipes } from '@/lib/db/schema';
import { mealDate } from '@/lib/utils/mealDate';
import type { DayOfWeek } from '@/lib/constants/days';
import type { LocalItem } from '../types';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** A meal-plan entry normalized into Prism's `meals` shape. */
export interface NormalizedMeal {
  entryId: string;
  name: string;
  description: string | null;
  servings: number | null;
  weekOf: string; // yyyy-MM-dd
  dayOfWeek: DayOfWeek;
  mealType: MealType;
  mealTime: string | null; // HH:mm, or null → UI substitutes a per-type default
}

/**
 * Content fingerprint of the fields that define a synced meal — computed
 * identically from a remote entry and a local row so an unchanged meal yields
 * the same string on both sides (sources here expose no updatedAt).
 *
 * The time of day is left out (#1206): Mealie plans have none, and a Tandoor
 * pull takes the meal type's default time, so a time set in Prism would read
 * as a difference on every sync and be overwritten.
 */
export function mealFingerprint(
  f: {
    name: string;
    weekOf: string;
    dayOfWeek: string;
    mealType: string;
    servings: number | null;
  },
  opts: MealFieldOptions = {},
): string {
  const servings = opts.servings === false ? '' : (f.servings ?? '');
  return JSON.stringify([f.name, f.weekOf, f.dayOfWeek, f.mealType, servings]);
}

/** Fields a source does not carry are left out of the comparison and kept on push. */
export interface MealFieldOptions {
  /** False for a source with no servings on its plan (Mealie). */
  servings?: boolean;
}

/** Local meals previously synced from a given source tag, as generic LocalItems. */
export async function loadLocalMeals(sourceTag: string, opts: MealFieldOptions = {}): Promise<LocalItem[]> {
  const rows = await db
    .select({
      id: meals.id,
      name: meals.name,
      weekOf: meals.weekOf,
      dayOfWeek: meals.dayOfWeek,
      mealType: meals.mealType,
      mealTime: meals.mealTime,
      servings: meals.servings,
      sourceId: meals.sourceId,
      updatedAt: meals.updatedAt,
    })
    .from(meals)
    .where(and(eq(meals.source, sourceTag), isNotNull(meals.sourceId)));

  return rows.map(
    (row): LocalItem => ({
      localId: row.id,
      externalId: row.sourceId,
      updatedAt: row.updatedAt,
      fingerprint: mealFingerprint(row, opts),
      label: `${row.name} — ${row.dayOfWeek} ${row.mealType}`,
    }),
  );
}

/** Insert or update a meal row from a normalized payload + resolved recipe link. */
export async function writeMealRow(
  sourceTag: string,
  p: NormalizedMeal,
  recipeId: string | null,
  localId: string | null,
): Promise<void> {
  const values = {
    name: p.name,
    description: p.description,
    recipeId,
    servings: p.servings,
    weekOf: p.weekOf,
    date: mealDate(p.weekOf, p.dayOfWeek),
    dayOfWeek: p.dayOfWeek,
    mealType: p.mealType,
    mealTime: p.mealTime,
    source: sourceTag,
    sourceId: p.entryId,
    updatedAt: new Date(),
  };
  if (localId) {
    await db.update(meals).set(values).where(eq(meals.id, localId));
  } else {
    await db.insert(meals).values(values);
  }
}

export async function deleteMealRow(localId: string): Promise<void> {
  await db.delete(meals).where(eq(meals.id, localId));
}

// --- Write-back (#1206) ---

/** Prism's default time for a meal type, when the meal has none. */
export const DEFAULT_MEAL_TIME: Record<MealType, string> = {
  breakfast: '07:00',
  lunch: '12:00',
  snack: '15:00',
  dinner: '18:00',
};

/**
 * Meals made in Prism that no source has yet, from today on, as candidates to
 * send to a source as new entries. Past meals are history and stay in Prism.
 * Once one is sent it is linked to that source, so it is offered only once.
 */
export async function loadPushCandidates(today: string): Promise<LocalItem[]> {
  const rows = await db
    .select({
      id: meals.id,
      name: meals.name,
      dayOfWeek: meals.dayOfWeek,
      mealType: meals.mealType,
      updatedAt: meals.updatedAt,
    })
    .from(meals)
    .where(and(eq(meals.source, 'internal'), isNull(meals.sourceId), gte(meals.date, today)));
  return rows.map((row) => ({
    localId: row.id,
    externalId: null,
    updatedAt: row.updatedAt,
    label: `${row.name} — ${row.dayOfWeek} ${row.mealType}`,
  }));
}

/**
 * After a meal is sent: make the local row match what the source stored, as a
 * pull would normalise it, and link it to the entry. Prism keeps its own time
 * of day and recipe link. Without this the next sync would see a difference
 * (say, servings filled in by the source) and offer to pull it back.
 */
export async function recordPushedMeal(
  localId: string,
  sourceTag: string,
  p: NormalizedMeal,
  opts: MealFieldOptions = {},
): Promise<void> {
  await db
    .update(meals)
    .set({
      name: p.name,
      description: p.description,
      ...(opts.servings === false ? {} : { servings: p.servings }),
      weekOf: p.weekOf,
      date: mealDate(p.weekOf, p.dayOfWeek),
      dayOfWeek: p.dayOfWeek,
      mealType: p.mealType,
      source: sourceTag,
      sourceId: p.entryId,
      updatedAt: new Date(),
    })
    .where(eq(meals.id, localId));
}

/** A local meal as it will be sent, with its recipe's id at this source if it came from there. */
export interface MealToPush {
  name: string;
  description: string | null;
  servings: number | null;
  date: string; // yyyy-MM-dd
  mealType: MealType;
  mealTime: string | null;
  /** The recipe's id at this source, or null when it is not from there. */
  recipeExternalId: string | null;
}

export async function loadMealToPush(localId: string, sourceId: string): Promise<MealToPush> {
  const [row] = await db
    .select({
      name: meals.name,
      description: meals.description,
      servings: meals.servings,
      date: meals.date,
      mealType: meals.mealType,
      mealTime: meals.mealTime,
      recipeSourceId: recipes.sourceId,
      recipeExternalId: recipes.externalId,
    })
    .from(meals)
    .leftJoin(recipes, eq(meals.recipeId, recipes.id))
    .where(eq(meals.id, localId));
  if (!row) throw new Error('The meal is no longer in Prism.');
  return {
    name: row.name,
    description: row.description,
    servings: row.servings,
    date: row.date,
    mealType: row.mealType,
    mealTime: row.mealTime,
    recipeExternalId: row.recipeSourceId === sourceId ? row.recipeExternalId : null,
  };
}

/** The source ids Prism holds a meal for, kept after each sync to spot removals. */
export async function syncedMealEntryIds(sourceTag: string): Promise<string[]> {
  const rows = await db
    .select({ sourceId: meals.sourceId })
    .from(meals)
    .where(and(eq(meals.source, sourceTag), isNotNull(meals.sourceId)));
  return rows.map((r) => r.sourceId).filter((v): v is string => v !== null);
}
