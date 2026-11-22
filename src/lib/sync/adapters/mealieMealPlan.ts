/**
 * Mealie meal-plan adapter. Maps Mealie's /api/households/mealplans entries onto
 * Prism `meals` via the shared mealWriter, reusing the same Mealie connection as
 * the recipe adapter.
 *
 * Mealie meal-plan entries are DATE-ONLY (no time) and carry no updatedAt, so:
 *  - mealTime is left null (Prism substitutes a per-type default on the grid);
 *  - edits are detected by content fingerprint;
 *  - the referenced recipe is auto-imported (by slug) on apply if missing.
 */

import { eq, inArray } from 'drizzle-orm';
import { startOfWeek, format } from 'date-fns';
import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import {
  fetchMealieMealPlan,
  createMealieMealPlanEntry,
  updateMealieMealPlanEntry,
  deleteMealieMealPlanEntry,
  type MealieMealPlanEntry,
  type MealieMealPlanWrite,
} from '@/lib/integrations/mealie';
import { getHouseholdTimezone } from '@/lib/householdTimezone';
import { todayKey } from '@/lib/utils/zonedDate';
import { DAYS_OF_WEEK, type DayOfWeek } from '@/lib/constants/days';
import { loadSourceConnection } from './tandoorSource';
import { ensureMealieRecipeImported } from './mealieRecipes';
import { importedRecipeExternalIds } from './recipeWriter';
import {
  mealFingerprint,
  loadLocalMeals,
  writeMealRow,
  deleteMealRow,
  loadPushCandidates,
  loadMealToPush,
  recordPushedMeal,
  type MealFieldOptions,
  type MealToPush,
  type NormalizedMeal,
  type MealType,
} from './mealWriter';
import type { EntitySyncAdapter, RemoteItem } from '../types';

const MEAL_SOURCE = 'mealie';
/** Mealie plans carry no servings: leave them out of the comparison, keep Prism's on push. */
const FIELDS: MealFieldOptions = { servings: false };

interface Payload extends NormalizedMeal {
  recipeExternalId: string | null;
  recipeSlug: string | null;
  recipeAlreadyImported: boolean;
}

async function loadWeekStartsOn(): Promise<0 | 1> {
  const rows = await db.select().from(settings).where(inArray(settings.key, ['weekStartsOn']));
  return rows[0]?.value === '1' ? 1 : 0;
}

/** Map Mealie entryType (breakfast|lunch|dinner|side|snack|drink|dessert) → Prism enum. */
function mapEntryType(t: string | null | undefined): MealType {
  const n = (t || '').toLowerCase();
  if (n === 'breakfast') return 'breakfast';
  if (n === 'lunch') return 'lunch';
  if (n === 'dinner') return 'dinner';
  // side / snack / drink / dessert / anything else → snack (the "other" slot)
  return 'snack';
}

/** Parse a date-only "YYYY-MM-DD" into a local Date (no timezone math needed). */
function parseDateOnly(s: string): Date {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(s);
}

function normalizeEntry(
  entry: MealieMealPlanEntry,
  weekStartsOn: 0 | 1,
  importedRecipeIds: Set<string>,
): Payload {
  const date = parseDateOnly(entry.date);
  const weekOf = format(startOfWeek(date, { weekStartsOn }), 'yyyy-MM-dd');
  const dayOfWeek = DAYS_OF_WEEK[date.getDay()] as DayOfWeek;
  const recipeExternalId = entry.recipeId || entry.recipe?.id || null;
  const recipeSlug = entry.recipe?.slug || null;
  const name = (entry.recipe?.name || entry.title || entry.text || 'Planned meal').trim() || 'Planned meal';
  return {
    entryId: String(entry.id),
    recipeExternalId,
    recipeSlug,
    recipeAlreadyImported: recipeExternalId ? importedRecipeIds.has(recipeExternalId) : false,
    name,
    description: (entry.text || '').trim() || null,
    servings: null, // Mealie meal-plan entries carry no servings
    weekOf,
    dayOfWeek,
    mealType: mapEntryType(entry.entryType),
    mealTime: null, // Mealie meal plans are date-only
  };
}

async function writeMeal(sourceId: string, p: Payload, localId: string | null): Promise<void> {
  let recipeId: string | null = null;
  if (p.recipeExternalId && p.recipeSlug) {
    const res = await ensureMealieRecipeImported(sourceId, p.recipeExternalId, p.recipeSlug);
    recipeId = res?.recipeId ?? null;
  }
  await writeMealRow(MEAL_SOURCE, p, recipeId, localId);
}

/** A Prism meal as a Mealie entry (date-only: Mealie plans have no time). */
export function toMealieEntry(meal: MealToPush): MealieMealPlanWrite {
  return {
    date: meal.date,
    entryType: meal.mealType,
    title: meal.name,
    text: meal.description ?? '',
    recipeId: meal.recipeExternalId,
  };
}

async function pushEntry(sourceId: string, localId: string, existingId: string | null): Promise<void> {
  const source = await loadSourceConnection(sourceId);
  const [meal, weekStartsOn] = await Promise.all([loadMealToPush(localId, sourceId), loadWeekStartsOn()]);
  const body = toMealieEntry(meal);
  const stored = existingId
    ? await updateMealieMealPlanEntry(source.serverUrl, source.token, existingId, body)
    : await createMealieMealPlanEntry(source.serverUrl, source.token, body);
  await recordPushedMeal(localId, MEAL_SOURCE, normalizeEntry(stored, weekStartsOn, new Set()), FIELDS);
}

export const mealieMealPlanAdapter: EntitySyncAdapter<Payload> = {
  entityType: 'meal',

  async fetchRemote(sourceId) {
    const source = await loadSourceConnection(sourceId);
    const [entries, weekStartsOn] = await Promise.all([
      fetchMealieMealPlan(source.serverUrl, source.token),
      loadWeekStartsOn(),
    ]);
    // Which referenced recipes are already imported (for the review side-effect).
    const ids = Array.from(
      new Set(entries.map((e) => e.recipeId || e.recipe?.id).filter((v): v is string => Boolean(v))),
    );
    const importedRecipeIds = await importedRecipeExternalIds(sourceId, ids);

    return entries.map((entry): RemoteItem<Payload> => {
      const p = normalizeEntry(entry, weekStartsOn, importedRecipeIds);
      return {
        externalId: p.entryId,
        updatedAt: null,
        fingerprint: mealFingerprint(p, FIELDS),
        label: `${p.name} — ${p.dayOfWeek} ${p.mealType}`,
        payload: p,
      };
    });
  },

  loadLocal: () => loadLocalMeals(MEAL_SOURCE, FIELDS),

  async applyAdd(sourceId, change) {
    if (change.payload) await writeMeal(sourceId, change.payload, null);
  },
  async applyUpdate(sourceId, change) {
    if (change.payload && change.localId) await writeMeal(sourceId, change.payload, change.localId);
  },
  async applyDelete(_sourceId, change) {
    if (change.localId) await deleteMealRow(change.localId);
  },

  push: {
    async loadCandidates() {
      return loadPushCandidates(todayKey(await getHouseholdTimezone()));
    },
    async pushAdd(sourceId, change) {
      if (change.localId) await pushEntry(sourceId, change.localId, null);
    },
    async pushUpdate(sourceId, change) {
      if (change.localId) await pushEntry(sourceId, change.localId, change.externalId);
    },
    async pushDelete(sourceId, change) {
      const source = await loadSourceConnection(sourceId);
      await deleteMealieMealPlanEntry(source.serverUrl, source.token, change.externalId);
    },
  },
};
