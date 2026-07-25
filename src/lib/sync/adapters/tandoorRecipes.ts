/**
 * Tandoor recipe adapter for the sync framework. Maps a Tandoor recipe source
 * onto the generic EntitySyncAdapter so the shared diff/review/apply machinery
 * can drive it. (Meal-plan, tasks, shopping, calendars = more adapters later.)
 */

import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { recipes, recipeSources } from '@/lib/db/schema';
import { decrypt } from '@/lib/utils/crypto';
import {
  fetchTandoorRecipes,
  fetchTandoorImage,
  type NormalizedTandoorRecipe,
} from '@/lib/integrations/tandoor';
import { saveRecipeImage } from '@/lib/services/recipe-image-storage';
import { logError } from '@/lib/utils/logError';
import type { EntitySyncAdapter, LocalItem, RemoteItem, SyncChange } from '../types';

/** The per-recipe data carried through the diff (Tandoor's normalized shape). */
type Payload = NormalizedTandoorRecipe;

interface ResolvedSource {
  serverUrl: string;
  token: string;
}

async function loadSource(sourceId: string): Promise<ResolvedSource> {
  const [src] = await db.select().from(recipeSources).where(eq(recipeSources.id, sourceId));
  if (!src) throw new Error('Recipe source not found');
  if (src.provider !== 'tandoor') throw new Error('Not a Tandoor recipe source');
  if (!src.serverUrl || !src.accessToken) {
    throw new Error('Recipe source is missing its server URL or API token');
  }
  return { serverUrl: src.serverUrl, token: decrypt(src.accessToken) };
}

async function upsertRecipe(
  source: ResolvedSource,
  sourceId: string,
  change: SyncChange<Payload>,
  localId: string | null,
): Promise<void> {
  const p = change.payload;
  if (!p) return;
  const values = {
    name: p.name,
    description: p.description,
    url: p.url,
    sourceType: 'tandoor_import' as const,
    sourceId,
    externalId: change.externalId,
    externalUpdatedAt: change.remoteUpdatedAt ?? null,
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
    if (!row) return;
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
}

export const tandoorRecipeAdapter: EntitySyncAdapter<Payload> = {
  entityType: 'recipe',

  async fetchRemote(sourceId) {
    const source = await loadSource(sourceId);
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
    const source = await loadSource(sourceId);
    await upsertRecipe(source, sourceId, change, null);
  },

  async applyUpdate(sourceId, change) {
    if (!change.localId) return;
    const source = await loadSource(sourceId);
    await upsertRecipe(source, sourceId, change, change.localId);
  },

  async applyDelete(_sourceId, change) {
    if (change.localId) {
      await db.delete(recipes).where(eq(recipes.id, change.localId));
    }
  },
};
