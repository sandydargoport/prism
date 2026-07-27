/**
 * Provider-agnostic recipe persistence shared by the Tandoor and Mealie
 * adapters. Both normalize their source into NormalizedRecipe and write it to
 * the same `recipes` table, so the row-write, image download, local-load, and
 * "ensure imported" logic lives here once.
 */

import { and, eq, isNotNull, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { recipes } from '@/lib/db/schema';
import { safeFetch } from '@/lib/utils/safeFetch';
import { saveRecipeImage } from '@/lib/services/recipe-image-storage';
import { logError } from '@/lib/utils/logError';
import type { LocalItem } from '../types';

/** A recipe normalized into Prism's insert shape (provider-independent). */
export interface NormalizedRecipe {
  externalId: string;
  externalUpdatedAt: Date | null;
  name: string;
  description: string | null;
  url: string;
  ingredients: Array<{ text?: string; heading?: string }>;
  instructions: string | null;
  prepTime: number | null;
  cookTime: number | null;
  servings: number | null;
  tags: string[];
  /** Absolute remote image URL to download with the source token, or null. */
  remoteImageUrl: string | null;
}

/** Best-effort download of a remote image via safeFetch (Bearer). Null on any failure. */
export async function fetchRemoteImage(url: string, token: string): Promise<Buffer | null> {
  try {
    const res = await safeFetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length ? buf : null;
  } catch {
    return null;
  }
}

/** Insert or update a recipe row from a normalized payload; returns its id. */
export async function writeRecipeRow(
  sourceId: string,
  p: NormalizedRecipe,
  token: string,
  localId: string | null,
): Promise<string> {
  const values = {
    name: p.name,
    description: p.description,
    url: p.url,
    sourceType: 'tandoor_import' as const,
    sourceId,
    externalId: p.externalId,
    // May arrive as an ISO string after a Redis JSON round-trip → coerce.
    externalUpdatedAt: p.externalUpdatedAt ? new Date(p.externalUpdatedAt) : null,
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

  if (p.remoteImageUrl) {
    const buffer = await fetchRemoteImage(p.remoteImageUrl, token);
    if (buffer) {
      try {
        await saveRecipeImage(buffer, recipeId);
        await db
          .update(recipes)
          .set({ imageUrl: `/api/recipes/${recipeId}/image?v=${Date.now()}` })
          .where(eq(recipes.id, recipeId));
      } catch (err) {
        logError('Recipe sync: failed to store recipe image', err);
      }
    }
  }
  return recipeId;
}

/** Local rows previously synced from this source, as generic LocalItems. */
export async function loadLocalRecipes(sourceId: string): Promise<LocalItem[]> {
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
}

/**
 * Ensure a recipe (by external id) exists locally for this source, importing it
 * via `fetchOne` if missing. Returns the local id + whether it was newly
 * imported, or null if it couldn't be fetched. Used by meal-plan adapters to
 * guarantee a planned meal links to a real recipe.
 */
export async function ensureRecipeImported(
  sourceId: string,
  externalId: string,
  token: string,
  fetchOne: (externalId: string) => Promise<NormalizedRecipe | null>,
): Promise<{ recipeId: string; imported: boolean } | null> {
  const [existing] = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.sourceId, sourceId), eq(recipes.externalId, externalId)));
  if (existing) return { recipeId: existing.id, imported: false };

  const norm = await fetchOne(externalId);
  if (!norm) return null;
  const recipeId = await writeRecipeRow(sourceId, norm, token, null);
  return { recipeId, imported: true };
}

/** Delete a synced recipe row by local id. */
export async function deleteRecipeRow(localId: string): Promise<void> {
  await db.delete(recipes).where(eq(recipes.id, localId));
}

/** Of the given remote recipe ids, which are already imported for this source. */
export async function importedRecipeExternalIds(
  sourceId: string,
  externalIds: string[],
): Promise<Set<string>> {
  if (externalIds.length === 0) return new Set();
  const rows = await db
    .select({ externalId: recipes.externalId })
    .from(recipes)
    .where(and(eq(recipes.sourceId, sourceId), inArray(recipes.externalId, externalIds)));
  return new Set(rows.map((r) => r.externalId).filter((v): v is string => v !== null));
}
