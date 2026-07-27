/**
 * Tandoor recipe adapter for the sync framework. Normalizes a Tandoor source
 * and persists it via the shared recipeWriter (row-write, image, local-load),
 * which the Mealie adapter reuses too.
 */

import {
  fetchTandoorRecipes,
  fetchTandoorRecipeById,
  type NormalizedTandoorRecipe,
} from '@/lib/integrations/tandoor';
import { loadTandoorSource } from './tandoorSource';
import {
  writeRecipeRow,
  loadLocalRecipes,
  deleteRecipeRow,
  ensureRecipeImported as ensureImported,
  type NormalizedRecipe,
} from './recipeWriter';
import type { EntitySyncAdapter, RemoteItem } from '../types';

type Payload = NormalizedTandoorRecipe;

/**
 * Ensure a Tandoor recipe (by external id) exists locally for this source,
 * importing it if missing. Used by the meal-plan adapter.
 */
export async function ensureRecipeImported(
  sourceId: string,
  externalId: string,
): Promise<{ recipeId: string; imported: boolean } | null> {
  const source = await loadTandoorSource(sourceId);
  return ensureImported(sourceId, externalId, source.token, (id) =>
    fetchTandoorRecipeById(source.serverUrl, source.token, Number(id)),
  );
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

  loadLocal: (sourceId) => loadLocalRecipes(sourceId),

  async applyAdd(sourceId, change) {
    if (!change.payload) return;
    const source = await loadTandoorSource(sourceId);
    await writeRecipeRow(sourceId, change.payload as NormalizedRecipe, source.token, null);
  },

  async applyUpdate(sourceId, change) {
    if (!change.payload || !change.localId) return;
    const source = await loadTandoorSource(sourceId);
    await writeRecipeRow(sourceId, change.payload as NormalizedRecipe, source.token, change.localId);
  },

  async applyDelete(_sourceId, change) {
    if (change.localId) await deleteRecipeRow(change.localId);
  },
};
