/**
 * Mealie recipe adapter. Same shared recipeWriter as Tandoor; only the fetch +
 * normalization (mealie.ts) and the by-slug import differ. Mealie recipes carry
 * a real updatedAt, so this rides the framework's timestamp (last-write-wins)
 * path with no fingerprint needed.
 */

import { fetchMealieRecipes, fetchMealieRecipeBySlug } from '@/lib/integrations/mealie';
import { loadSourceConnection } from './tandoorSource';
import {
  writeRecipeRow,
  loadLocalRecipes,
  deleteRecipeRow,
  ensureRecipeImported as ensureImported,
  type NormalizedRecipe,
} from './recipeWriter';
import type { EntitySyncAdapter, RemoteItem } from '../types';

type Payload = NormalizedRecipe;

/**
 * Ensure a Mealie recipe exists locally for this source, importing it by slug
 * if missing. `externalId` is the recipe's Mealie id (the sync/dedup key);
 * `slug` is what the API fetches by. Used by the meal-plan adapter.
 */
export async function ensureMealieRecipeImported(
  sourceId: string,
  externalId: string,
  slug: string,
): Promise<{ recipeId: string; imported: boolean } | null> {
  const source = await loadSourceConnection(sourceId);
  return ensureImported(sourceId, externalId, source.token, () =>
    fetchMealieRecipeBySlug(source.serverUrl, source.token, slug),
  );
}

export const mealieRecipeAdapter: EntitySyncAdapter<Payload> = {
  entityType: 'recipe',

  async fetchRemote(sourceId) {
    const source = await loadSourceConnection(sourceId);
    const { recipes: items } = await fetchMealieRecipes(source.serverUrl, source.token);
    return items.map(
      (r): RemoteItem<Payload> => ({
        externalId: r.externalId,
        updatedAt: r.externalUpdatedAt,
        label: r.name,
        payload: r,
      }),
    );
  },

  loadLocal: (sourceId) => loadLocalRecipes(sourceId),

  async applyAdd(sourceId, change) {
    if (!change.payload) return;
    const source = await loadSourceConnection(sourceId);
    await writeRecipeRow(sourceId, change.payload, source.token, null);
  },

  async applyUpdate(sourceId, change) {
    if (!change.payload || !change.localId) return;
    const source = await loadSourceConnection(sourceId);
    await writeRecipeRow(sourceId, change.payload, source.token, change.localId);
  },

  async applyDelete(_sourceId, change) {
    if (change.localId) await deleteRecipeRow(change.localId);
  },
};
