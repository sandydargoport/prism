/**
 * Tandoor meal-plan adapter. Maps Tandoor's /api/meal-plan/ entries onto Prism
 * `meals` via the shared mealWriter, reusing the SAME Tandoor connection as the
 * recipe adapter.
 *
 * Tandoor meal-plan entries expose no updatedAt → edits are detected by content
 * fingerprint. A planned meal's recipe is auto-imported on apply if missing.
 */

import { and, eq, isNotNull } from 'drizzle-orm';
import { startOfWeek, format } from 'date-fns';
import { db } from '@/lib/db/client';
import { recipes, settings } from '@/lib/db/schema';
import { fetchTandoorMealPlan, type TandoorMealPlanEntry } from '@/lib/integrations/tandoor';
import { DAYS_OF_WEEK, type DayOfWeek } from '@/lib/constants/days';
import { zonedParts } from '@/lib/utils/timezone';
import { loadTandoorSource } from './tandoorSource';
import { ensureRecipeImported } from './tandoorRecipes';
import {
  mealFingerprint,
  loadLocalMeals,
  writeMealRow,
  deleteMealRow,
  type NormalizedMeal,
  type MealType,
} from './mealWriter';
import { inArray } from 'drizzle-orm';
import type { EntitySyncAdapter, RemoteItem } from '../types';

const MEAL_SOURCE = 'tandoor';

/** Normalized Tandoor meal-plan entry (+ recipe link info). */
interface Payload extends NormalizedMeal {
  recipeExternalId: string | null;
  recipeAlreadyImported: boolean;
}

async function loadTimeSettings(): Promise<{ weekStartsOn: 0 | 1; timezone: string }> {
  const rows = await db.select().from(settings).where(inArray(settings.key, ['weekStartsOn', 'timezone']));
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  return {
    weekStartsOn: byKey.get('weekStartsOn') === '1' ? 1 : 0,
    timezone: (byKey.get('timezone') as string) || 'UTC',
  };
}

function mapMealType(name: string | null | undefined): MealType {
  const n = (name || '').toLowerCase();
  if (n.includes('breakfast') || n.includes('brunch')) return 'breakfast';
  if (n.includes('lunch')) return 'lunch';
  if (n.includes('snack') || n.includes('dessert') || n.includes('appetiz')) return 'snack';
  return 'dinner';
}

function toNumber(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function normalizeEntry(
  entry: TandoorMealPlanEntry,
  weekStartsOn: 0 | 1,
  timezone: string,
  importedRecipeIds: Set<string>,
): Payload {
  const { date, time: fromDateTime } = zonedParts(entry.from_date, timezone);
  const weekOf = format(startOfWeek(date, { weekStartsOn }), 'yyyy-MM-dd');
  const dayOfWeek = DAYS_OF_WEEK[date.getDay()] as DayOfWeek;
  // Prefer the meal type's naive default time (timezone-free); fall back to the
  // zoned from_date time only when the meal type has none.
  const mealTypeTime = entry.meal_type?.time?.match(/^(\d{2}:\d{2})/)?.[1] ?? null;
  const recipeExternalId = entry.recipe?.id != null ? String(entry.recipe.id) : null;
  const name =
    (entry.recipe_name || entry.recipe?.name || entry.title || 'Planned meal').trim() || 'Planned meal';
  return {
    entryId: String(entry.id),
    recipeExternalId,
    recipeAlreadyImported: recipeExternalId ? importedRecipeIds.has(recipeExternalId) : false,
    name,
    description: (entry.note || '').trim() || null,
    servings: toNumber(entry.servings),
    weekOf,
    dayOfWeek,
    mealType: mapMealType(entry.meal_type_name),
    mealTime: mealTypeTime ?? fromDateTime,
  };
}

async function writeMeal(sourceId: string, p: Payload, localId: string | null): Promise<void> {
  let recipeId: string | null = null;
  if (p.recipeExternalId) {
    const res = await ensureRecipeImported(sourceId, p.recipeExternalId);
    recipeId = res?.recipeId ?? null;
  }
  await writeMealRow(MEAL_SOURCE, p, recipeId, localId);
}

export const tandoorMealPlanAdapter: EntitySyncAdapter<Payload> = {
  entityType: 'meal',

  async fetchRemote(sourceId) {
    const source = await loadTandoorSource(sourceId);
    const [entries, timeSettings, importedRows] = await Promise.all([
      fetchTandoorMealPlan(source.serverUrl, source.token),
      loadTimeSettings(),
      db
        .select({ externalId: recipes.externalId })
        .from(recipes)
        .where(and(eq(recipes.sourceId, sourceId), isNotNull(recipes.externalId))),
    ]);
    const importedRecipeIds = new Set(
      importedRows.map((r) => r.externalId).filter((v): v is string => v !== null),
    );

    return entries.map((entry): RemoteItem<Payload> => {
      const p = normalizeEntry(entry, timeSettings.weekStartsOn, timeSettings.timezone, importedRecipeIds);
      return {
        externalId: p.entryId,
        updatedAt: null,
        fingerprint: mealFingerprint(p),
        label: `${p.name} — ${p.dayOfWeek} ${p.mealType}`,
        payload: p,
      };
    });
  },

  loadLocal: () => loadLocalMeals(MEAL_SOURCE),

  async applyAdd(sourceId, change) {
    if (change.payload) await writeMeal(sourceId, change.payload, null);
  },
  async applyUpdate(sourceId, change) {
    if (change.payload && change.localId) await writeMeal(sourceId, change.payload, change.localId);
  },
  async applyDelete(_sourceId, change) {
    if (change.localId) await deleteMealRow(change.localId);
  },
};
