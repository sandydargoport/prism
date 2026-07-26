/**
 * Tandoor meal-plan adapter for the sync framework. Maps Tandoor's
 * /api/meal-plan/ entries onto Prism `meals` rows, reusing the SAME Tandoor
 * connection (recipe_sources) as the recipe adapter.
 *
 * Two things make meal plans different from recipes:
 *  1. Tandoor meal-plan entries expose NO updatedAt — so edits are detected by
 *     a content fingerprint (see mealFingerprint) instead of last-write-wins.
 *  2. A planned meal references a recipe. On apply we auto-import that recipe if
 *     it isn't in Prism yet (ensureRecipeImported), so every synced meal links
 *     to a real recipe. The review surfaces which recipes it will also import.
 *
 * NOTE: assumes a single Tandoor connection (local meals are matched by
 * source='tandoor'). Multi-Tandoor support would key meals to the source id.
 */

import { and, eq, isNotNull, inArray } from 'drizzle-orm';
import { startOfWeek, format } from 'date-fns';
import { db } from '@/lib/db/client';
import { meals, recipes, settings } from '@/lib/db/schema';
import { fetchTandoorMealPlan, type TandoorMealPlanEntry } from '@/lib/integrations/tandoor';
import { DAYS_OF_WEEK, type DayOfWeek } from '@/lib/constants/days';
import { zonedParts } from '@/lib/utils/timezone';
import { loadTandoorSource } from './tandoorSource';
import { ensureRecipeImported } from './tandoorRecipes';
import type { EntitySyncAdapter, LocalItem, RemoteItem, SyncChange } from '../types';

const MEAL_SOURCE = 'tandoor';
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** Normalized Tandoor meal-plan entry in Prism's meal shape. */
export interface NormalizedTandoorMeal {
  entryId: string;
  /** Tandoor recipe id this meal plans, or null if the entry has no recipe. */
  recipeExternalId: string | null;
  /** Whether that recipe is already imported (computed at fetch time). */
  recipeAlreadyImported: boolean;
  name: string;
  description: string | null;
  servings: number | null;
  weekOf: string; // yyyy-MM-dd (start of week, honoring weekStartsOn)
  dayOfWeek: DayOfWeek;
  mealType: MealType;
  mealTime: string | null; // HH:mm
}

/** Read the household date/time settings that shape meal bucketing. */
async function loadTimeSettings(): Promise<{ weekStartsOn: 0 | 1; timezone: string }> {
  const rows = await db
    .select()
    .from(settings)
    .where(inArray(settings.key, ['weekStartsOn', 'timezone']));
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  return {
    weekStartsOn: byKey.get('weekStartsOn') === '1' ? 1 : 0,
    // Default UTC when unset; the meal-type time usually wins anyway (naive).
    timezone: (byKey.get('timezone') as string) || 'UTC',
  };
}

/** Map Tandoor's free-text meal type name onto Prism's fixed enum. */
function mapMealType(name: string | null | undefined): MealType {
  const n = (name || '').toLowerCase();
  if (n.includes('breakfast') || n.includes('brunch')) return 'breakfast';
  if (n.includes('lunch')) return 'lunch';
  if (n.includes('snack') || n.includes('dessert') || n.includes('appetiz')) return 'snack';
  // dinner / supper / anything else → dinner (the common default)
  return 'dinner';
}

function toNumber(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/**
 * Content fingerprint of the fields that define a synced meal. Computed
 * identically from a remote entry and a local row, so an unchanged meal
 * produces the same string on both sides (→ no spurious "changed").
 */
function mealFingerprint(f: {
  name: string;
  weekOf: string;
  dayOfWeek: string;
  mealType: string;
  mealTime: string | null;
  servings: number | null;
}): string {
  return JSON.stringify([f.name, f.weekOf, f.dayOfWeek, f.mealType, f.mealTime ?? '', f.servings ?? '']);
}

function normalizeEntry(
  entry: TandoorMealPlanEntry,
  weekStartsOn: 0 | 1,
  timezone: string,
  importedRecipeIds: Set<string>,
): NormalizedTandoorMeal {
  // Interpret from_date (an absolute instant) in the household timezone, so the
  // day/week land correctly regardless of Tandoor's server zone.
  const { date, time: fromDateTime } = zonedParts(entry.from_date, timezone);
  const weekOf = format(startOfWeek(date, { weekStartsOn }), 'yyyy-MM-dd');
  const dayOfWeek = DAYS_OF_WEEK[date.getDay()] as DayOfWeek;
  // Prefer the meal type's naive default time ("18:00:00" → "18:00"): it's
  // timezone-free and matches the user's intent ("Dinner = 6pm"). Tandoor's
  // from_date carries a DST artifact, so only fall back to the (zoned) from_date
  // time when the meal type has no time of its own.
  const mealTypeTime = entry.meal_type?.time?.match(/^(\d{2}:\d{2})/)?.[1] ?? null;
  const time = mealTypeTime ?? fromDateTime;
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
    mealTime: time,
  };
}

type Payload = NormalizedTandoorMeal;

/** Insert/update a meal row from a normalized payload; returns nothing. */
async function writeMeal(
  sourceId: string,
  p: Payload,
  localId: string | null,
): Promise<void> {
  // Auto-import the referenced recipe if it isn't in Prism yet, then link it.
  let recipeId: string | null = null;
  if (p.recipeExternalId) {
    const res = await ensureRecipeImported(sourceId, p.recipeExternalId);
    recipeId = res?.recipeId ?? null;
  }

  const values = {
    name: p.name,
    description: p.description,
    recipeId,
    servings: p.servings,
    weekOf: p.weekOf,
    dayOfWeek: p.dayOfWeek,
    mealType: p.mealType,
    mealTime: p.mealTime,
    source: MEAL_SOURCE,
    sourceId: p.entryId,
    updatedAt: new Date(),
  };

  if (localId) {
    await db.update(meals).set(values).where(eq(meals.id, localId));
  } else {
    await db.insert(meals).values(values);
  }
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
        updatedAt: null, // Tandoor meal-plan entries have no updatedAt
        fingerprint: mealFingerprint(p),
        label: `${p.name} — ${p.dayOfWeek} ${p.mealType}`,
        payload: p,
      };
    });
  },

  async loadLocal(sourceId) {
    void sourceId; // single-Tandoor: local meals are matched by source tag
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
      .where(and(eq(meals.source, MEAL_SOURCE), isNotNull(meals.sourceId)));

    return rows.map(
      (row): LocalItem => ({
        localId: row.id,
        externalId: row.sourceId,
        updatedAt: row.updatedAt,
        fingerprint: mealFingerprint({
          name: row.name,
          weekOf: row.weekOf,
          dayOfWeek: row.dayOfWeek,
          mealType: row.mealType,
          mealTime: row.mealTime,
          servings: row.servings,
        }),
        label: `${row.name} — ${row.dayOfWeek} ${row.mealType}`,
      }),
    );
  },

  async applyAdd(sourceId, change) {
    if (!change.payload) return;
    await writeMeal(sourceId, change.payload, null);
  },

  async applyUpdate(sourceId, change) {
    if (!change.payload || !change.localId) return;
    await writeMeal(sourceId, change.payload, change.localId);
  },

  async applyDelete(_sourceId, change) {
    if (change.localId) {
      await db.delete(meals).where(eq(meals.id, change.localId));
    }
  },
};
