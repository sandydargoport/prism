/**
 * Tandoor recipe adapter for the sync framework. Maps a Tandoor recipe source
 * onto the generic EntitySyncAdapter so the shared diff/review/apply machinery
 * can drive it. (Meal-plan, tasks, shopping, calendars = more adapters later.)
 */

import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { recipes } from '@/lib/db/schema';
import {
  fetchTandoorRecipes,
  fetchTandoorRecipeById,
  fetchTandoorImage,
  type NormalizedTandoorRecipe,
} from '@/lib/integrations/tandoor';
import { saveRecipeImage } from '@/lib/services/recipe-image-storage';
import { logError } from '@/lib/utils/logError';
import { loadTandoorSource, type ResolvedTandoorSource } from './tandoorSource';
import type { EntitySyncAdapter, LocalItem, RemoteItem, SyncChange } from '../types';

/** The per-recipe data carried through the diff (Tandoor's normalized shape). */
type Payload = NormalizedTandoorRecipe;

/**
 * Insert or update a single recipe row from a normalized Tandoor payload, then
 * best-effort download its image. Returns the local recipe id. Shared by the
 * sync apply path and by ensureRecipeImported (meal-plan auto-import).
 */
async function writeRecipe(
  source: ResolvedTandoorSource,
  sourceId: string,
  p: Payload,
  externalId: string,
  externalUpdatedAt: Date | null,
  localId: string | null,
): Promise<string> {
  const values = {
    name: p.name,
    description: p.description,
    url: p.url,
    sourceType: 'tandoor_import' as const,
    sourceId,
    externalId,
    externalUpdatedAt,
    ingredients: p.ingredients,
    instructions: p.instructions,
    prepTime: p.prepTime,
    cookTime: p.cookTime,
    servings: p.servings,
    tags: p.tags,
    updatedAt: new Date(),
  };

  let recipeId: string;
  if (localId) {
    await db.update(recipes).set(values).where(eq(recipes.id, localId));
    recipeId = localId;
  } else {
    const [row] = await db.insert(recipes).values(values).returning({ id: recipes.id });
    if (!row) throw new Error('Failed to insert recipe');
    recipeId = row.id;
  }

  // Best-effort image download (server-side, with the token) → local store.
  if (p.remoteImageUrl) {
    const buffer = await fetchTandoorImage(p.remoteImageUrl, source.token);
    if (buffer) {
      try {
        await saveRecipeImage(buffer, recipeId);
        await db
          .update(recipes)
          .set({ imageUrl: `/api/recipes/${recipeId}/image?v=${Date.now()}` })
          .where(eq(recipes.id, recipeId));
      } catch (err) {
        logError('Tandoor sync: failed to store recipe image', err);
      }
    }
  }
  return recipeId;
}

/** Apply a recipe add/update SyncChange (remoteUpdatedAt may be a Redis string). */
async function upsertRecipe(
  source: ResolvedTandoorSource,
  sourceId: string,
  change: SyncChange<Payload>,
  localId: string | null,
): Promise<void> {
  const p = change.payload;
  if (!p) return;
  const externalUpdatedAt = change.remoteUpdatedAt ? new Date(change.remoteUpdatedAt) : null;
  await writeRecipe(source, sourceId, p, change.externalId, externalUpdatedAt, localId);
}

/**
 * Ensure a Tandoor recipe (by external id) exists locally for this source,
 * importing it if missing. Returns the local recipe id + whether it was newly
 * imported, or null if the recipe couldn't be fetched. Used by the meal-plan
 * adapter so a planned meal always links to a real recipe.
 */
export async function ensureRecipeImported(
  sourceId: string,
  externalId: string,
): Promise<{ recipeId: string; imported: boolean } | null> {
  const [existing] = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.sourceId, sourceId), eq(recipes.externalId, externalId)));
  if (existing) return { recipeId: existing.id, imported: false };

  const source = await loadTandoorSource(sourceId);
  const norm = await fetchTandoorRecipeById(source.serverUrl, source.token, Number(externalId));
  if (!norm) return null;
  const recipeId = await writeRecipe(source, sourceId, norm, norm.externalId, norm.externalUpdatedAt, null);
  return { recipeId, imported: true };
}

/** Whether a Tandoor recipe (external id) is already imported for this source. */
export async function isRecipeImported(sourceId: string, externalId: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.sourceId, sourceId), eq(recipes.externalId, externalId)));
  return Boolean(existing);
}

export const tandoorRecipeAdapter: EntitySyncAdapter<Payload> = {
  entityType: 'recipe',

  async fetchRemote(sourceId) {
    const source = await loadTandoorSource(sourceId);
    const { recipes: items } = await fetchTandoorRecipes(source.serverUrl, source.token);
    return items.map(
      (r): RemoteItem<Payload> => ({
        externalId: r.externalId,
        updatedAt: r.externalUpdatedAt,
        label: r.name,
        payload: r,
      }),
    );
  },

  async loadLocal(sourceId) {
    const rows = await db
      .select({
        id: recipes.id,
        externalId: recipes.externalId,
        updatedAt: recipes.updatedAt,
        name: recipes.name,
      })
      .from(recipes)
      .where(and(eq(recipes.sourceId, sourceId), isNotNull(recipes.externalId)));
    return rows.map(
      (row): LocalItem => ({
        localId: row.id,
        externalId: row.externalId,
        updatedAt: row.updatedAt,
        label: row.name,
      }),
    );
  },

  async applyAdd(sourceId, change) {
    const source = await loadTandoorSource(sourceId);
    await upsertRecipe(source, sourceId, change, null);
  },

  async applyUpdate(sourceId, change) {
    if (!change.localId) return;
    const source = await loadTandoorSource(sourceId);
    await upsertRecipe(source, sourceId, change, change.localId);
  },

  async applyDelete(_sourceId, change) {
    if (change.localId) {
      await db.delete(recipes).where(eq(recipes.id, change.localId));
    }
  },
};
