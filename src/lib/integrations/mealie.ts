/**
 * Mealie (mealie-recipes) API client. Read-only pulls of recipes and meal-plan
 * entries into Prism, mirroring the Tandoor client. Mealie is DRF-like with a
 * long-lived bearer API token. Every call goes through safeFetch/validatePublicUrl
 * so a user-supplied serverUrl can't be used for SSRF.
 *
 * Confirmed against Mealie v3.21.0:
 *  - GET /api/recipes            → { items:[{id,slug,name,...}], total, next, ... }
 *  - GET /api/recipes/{slug}     → full recipe (ingredients have a `display` string)
 *  - GET /api/households/mealplans → { items:[{id,date,entryType,recipeId,recipe}] }
 *  - recipes expose updatedAt (real last-write-wins); meal-plan entries do not.
 */

import { validatePublicUrl, safeFetch, UnsafeUrlError } from '@/lib/utils/safeFetch';
import type { NormalizedRecipe } from '@/lib/sync/adapters/recipeWriter';

const PAGE_SIZE = 50;
const MAX_RECIPES = 1000;
const MAX_MEAL_PLAN = 2000;

function baseUrl(serverUrl: string): string {
  return serverUrl.trim().replace(/\/+$/, '');
}
function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
}

// --- Partial shapes of the Mealie responses we read ---
interface MealiePage<T> {
  items?: T[];
  total?: number;
  next?: string | null;
}
interface MealieNamed { name?: string | null }
interface MealieIngredient {
  quantity?: number | null;
  unit?: MealieNamed | null;
  food?: MealieNamed | null;
  note?: string | null;
  display?: string | null;
  title?: string | null;
  originalText?: string | null;
}
interface MealieStep { title?: string | null; text?: string | null }
export interface MealieRecipeDetail {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  image?: unknown; // truthy cache-key string when an image exists
  recipeServings?: number | null;
  recipeYield?: string | null;
  prepTime?: string | null;
  performTime?: string | null;
  totalTime?: string | null;
  orgURL?: string | null;
  updatedAt?: string | null;
  recipeIngredient?: MealieIngredient[];
  recipeInstructions?: MealieStep[];
  tags?: MealieNamed[];
}
export interface MealieMealPlanEntry {
  id: number;
  date: string; // YYYY-MM-DD (date only)
  entryType?: string | null; // breakfast|lunch|dinner|side|snack|drink|dessert
  title?: string | null;
  text?: string | null;
  recipeId?: string | null;
  recipe?: { id: string; slug: string; name?: string | null } | null;
}

/** Verify the server is reachable and the token authenticates. */
export async function testMealieConnection(
  serverUrl: string,
  token: string,
): Promise<{ ok: true }> {
  validatePublicUrl(serverUrl);
  const res = await safeFetch(`${baseUrl(serverUrl)}/api/users/self`, { headers: authHeaders(token) });
  if (res.status === 401 || res.status === 403) {
    throw new Error('Mealie rejected the API token — check the token in Mealie → Profile → API Tokens.');
  }
  if (!res.ok) {
    throw new Error(`Could not reach Mealie: ${res.status} ${res.statusText}`);
  }
  return { ok: true };
}

/** Parse a Mealie duration ("30 minutes", "1 hour 15 min", "PT30M") to minutes. */
function parseDurationMinutes(s: string | null | undefined): number | null {
  if (!s) return null;
  const iso = s.match(/^PT(?:(\d+)H)?(?:(\d+)M)?/i);
  if (iso && (iso[1] || iso[2])) return Number(iso[1] || 0) * 60 + Number(iso[2] || 0);
  let mins = 0;
  let found = false;
  const h = s.match(/(\d+)\s*(?:h|hr|hour)/i);
  if (h) { mins += Number(h[1]) * 60; found = true; }
  const m = s.match(/(\d+)\s*(?:m|min|minute)/i);
  if (m) { mins += Number(m[1]); found = true; }
  if (found) return mins;
  const n = s.match(/(\d+)/);
  return n ? Number(n[1]) : null;
}

function normalizeIngredients(list: MealieIngredient[]): Array<{ text?: string; heading?: string }> {
  const out: Array<{ text?: string; heading?: string }> = [];
  for (const ing of list) {
    const heading = (ing.title || '').trim();
    if (heading) out.push({ heading });
    const text = (ing.display || ing.originalText || '').trim();
    if (text) out.push({ text });
  }
  return out;
}

function normalizeInstructions(steps: MealieStep[]): string | null {
  const parts: string[] = [];
  for (const step of steps) {
    const text = (step.text || '').trim();
    if (!text) continue;
    const title = (step.title || '').trim();
    parts.push(title ? `${title}\n${text}` : text);
  }
  return parts.length ? parts.join('\n\n') : null;
}

/** Map a full Mealie recipe into Prism's normalized insert shape. */
export function normalizeMealieRecipe(detail: MealieRecipeDetail, base: string): NormalizedRecipe {
  const prep = parseDurationMinutes(detail.prepTime);
  const perform = parseDurationMinutes(detail.performTime);
  // Mealie splits prep/perform; when only totalTime is set, surface it as cook.
  const cook = perform ?? (prep === null ? parseDurationMinutes(detail.totalTime) : null);
  const servings = typeof detail.recipeServings === 'number' && detail.recipeServings > 0
    ? Math.round(detail.recipeServings)
    : null;
  return {
    externalId: detail.id,
    externalUpdatedAt: detail.updatedAt ? new Date(detail.updatedAt) : null,
    name: detail.name,
    description: (detail.description || '').trim() || null,
    url: (detail.orgURL || '').trim() || `${base}/g/home/r/${detail.slug}`,
    ingredients: normalizeIngredients(detail.recipeIngredient ?? []),
    instructions: normalizeInstructions(detail.recipeInstructions ?? []),
    prepTime: prep,
    cookTime: cook,
    servings,
    tags: (detail.tags ?? []).map((t) => (t.name || '').trim()).filter(Boolean),
    remoteImageUrl: detail.image ? `${base}/api/media/recipes/${detail.id}/images/original.webp` : null,
  };
}

/** Page through /api/recipes collecting slugs (bounded). */
async function listRecipeSlugs(base: string, token: string): Promise<string[]> {
  const slugs: string[] = [];
  let page = 1;
  let guard = 0;
  while (slugs.length < MAX_RECIPES && guard < 200) {
    guard += 1;
    const res = await safeFetch(`${base}/api/recipes?page=${page}&perPage=${PAGE_SIZE}`, {
      headers: authHeaders(token),
    });
    if (!res.ok) throw new Error(`Failed to list Mealie recipes: ${res.status} ${res.statusText}`);
    const data = (await res.json()) as MealiePage<{ slug: string }>;
    const items = data.items ?? [];
    for (const it of items) if (it.slug) slugs.push(it.slug);
    if (items.length < PAGE_SIZE || !data.next) break;
    page += 1;
  }
  return slugs.slice(0, MAX_RECIPES);
}

async function fetchRecipeDetail(base: string, token: string, slug: string): Promise<MealieRecipeDetail> {
  const res = await safeFetch(`${base}/api/recipes/${encodeURIComponent(slug)}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Failed to fetch Mealie recipe ${slug}: ${res.status} ${res.statusText}`);
  return (await res.json()) as MealieRecipeDetail;
}

/** Fetch + normalize every recipe from a Mealie server (bounded). */
export async function fetchMealieRecipes(
  serverUrl: string,
  token: string,
): Promise<{ recipes: NormalizedRecipe[]; total: number }> {
  validatePublicUrl(serverUrl);
  const base = baseUrl(serverUrl);
  const slugs = await listRecipeSlugs(base, token);
  const recipes: NormalizedRecipe[] = [];
  for (const slug of slugs) {
    try {
      const detail = await fetchRecipeDetail(base, token, slug);
      if (detail && detail.name) recipes.push(normalizeMealieRecipe(detail, base));
    } catch (err) {
      console.error(`[mealie] skipping recipe ${slug}:`, err instanceof Error ? err.message : err);
    }
  }
  return { recipes, total: slugs.length };
}

/** Fetch + normalize a single Mealie recipe by slug (for meal-plan auto-import). */
export async function fetchMealieRecipeBySlug(
  serverUrl: string,
  token: string,
  slug: string,
): Promise<NormalizedRecipe | null> {
  validatePublicUrl(serverUrl);
  const base = baseUrl(serverUrl);
  try {
    const detail = await fetchRecipeDetail(base, token, slug);
    if (detail && detail.name) return normalizeMealieRecipe(detail, base);
  } catch (err) {
    console.error(`[mealie] failed to fetch recipe ${slug}:`, err instanceof Error ? err.message : err);
  }
  return null;
}

/** Fetch all meal-plan entries from Mealie (bounded). */
export async function fetchMealieMealPlan(
  serverUrl: string,
  token: string,
): Promise<MealieMealPlanEntry[]> {
  validatePublicUrl(serverUrl);
  const base = baseUrl(serverUrl);
  const out: MealieMealPlanEntry[] = [];
  let page = 1;
  let guard = 0;
  while (out.length < MAX_MEAL_PLAN && guard < 200) {
    guard += 1;
    const res = await safeFetch(`${base}/api/households/mealplans?page=${page}&perPage=${PAGE_SIZE}`, {
      headers: authHeaders(token),
    });
    if (!res.ok) throw new Error(`Failed to list Mealie meal plan: ${res.status} ${res.statusText}`);
    const data = (await res.json()) as MealiePage<MealieMealPlanEntry>;
    const items = data.items ?? [];
    for (const e of items) if (e && typeof e.id === 'number' && e.date) out.push(e);
    if (items.length < PAGE_SIZE || !data.next) break;
    page += 1;
  }
  return out.slice(0, MAX_MEAL_PLAN);
}

export { UnsafeUrlError };
