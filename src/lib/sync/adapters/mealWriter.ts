/**
 * Provider-agnostic meal persistence shared by the Tandoor and Mealie meal-plan
 * adapters. Both map their source into a NormalizedMeal and write to the same
 * `meals` table (tagged by `source`), so fingerprinting, local-load, row-write,
 * and delete live here once. Recipe auto-import stays provider-specific.
 *
 * NOTE: local meals are matched by their `source` tag ('tandoor' | 'mealie'),
 * which assumes one connection per provider.
 */

import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { meals } from '@/lib/db/schema';
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
 */
export function mealFingerprint(f: {
  name: string;
  weekOf: string;
  dayOfWeek: string;
  mealType: string;
  mealTime: string | null;
  servings: number | null;
}): string {
  return JSON.stringify([f.name, f.weekOf, f.dayOfWeek, f.mealType, f.mealTime ?? '', f.servings ?? '']);
}

/** Local meals previously synced from a given source tag, as generic LocalItems. */
export async function loadLocalMeals(sourceTag: string): Promise<LocalItem[]> {
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
      fingerprint: mealFingerprint(row),
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
