/**
 * Tandoor (tandoor.dev) recipe import client.
 *
 * One-way, read-only: pulls recipes FROM a Tandoor server into Prism as a
 * one-shot import (mirrors the URL / Paprika import paths). The Tandoor API
 * is DRF-based; a personal API token (scope `read`) is passed as a Bearer
 * token. Every outbound call goes through safeFetch/validatePublicUrl so a
 * user-supplied serverUrl can't be used to probe the internal network (SSRF).
 */

import { validatePublicUrl, safeFetch, UnsafeUrlError } from '@/lib/utils/safeFetch';

/** A recipe normalized into Prism's insert shape (minus createdBy/sourceType). */
export interface NormalizedTandoorRecipe {
  /** Tandoor recipe id (stringified) — the sync match key. */
  externalId: string;
  /** Tandoor's last-modified time, or null if absent — for last-write-wins. */
  externalUpdatedAt: Date | null;
  name: string;
  description: string | null;
  /** Deep link back to the recipe in Tandoor (for the "Open in source" link). */
  url: string;
  ingredients: Array<{ text?: string; heading?: string }>;
  instructions: string | null;
  prepTime: number | null;
  cookTime: number | null;
  servings: number | null;
  tags: string[];
  /** Absolute remote image URL to download, or null. */
  remoteImageUrl: string | null;
}

// --- Partial shapes of the Tandoor API responses we read ---
interface TandoorListResponse {
  count: number;
  next: string | null;
  results: Array<{ id: number }>;
}
interface TandoorNamed { name?: string | null }
interface TandoorIngredient {
  food?: TandoorNamed | null;
  unit?: TandoorNamed | null;
  amount?: number | string | null;
  note?: string | null;
  is_header?: boolean;
  no_amount?: boolean;
  original_text?: string | null;
}
interface TandoorStep {
  name?: string | null;
  instruction?: string | null;
  ingredients?: TandoorIngredient[];
}
export interface TandoorRecipeDetail {
  id: number;
  name: string;
  description?: string | null;
  image?: string | null;
  keywords?: TandoorNamed[];
  steps?: TandoorStep[];
  working_time?: number | null;
  waiting_time?: number | null;
  servings?: number | null;
  source_url?: string | null;
  /** ISO timestamp of the recipe's last change in Tandoor (for last-write-wins). */
  updated_at?: string | null;
}

const PAGE_SIZE = 50;
const MAX_RECIPES = 1000; // hard cap so a huge library can't run unbounded
const MAX_MEAL_PLAN = 2000; // hard cap on meal-plan entries pulled in one sync

/** A meal-plan entry from Tandoor's /api/meal-plan/ (the fields we consume). */
export interface TandoorMealPlanEntry {
  id: number;
  title?: string | null;
  recipe?: { id: number; name?: string | null; image?: string | null } | null;
  recipe_name?: string | null;
  servings?: number | string | null;
  note?: string | null;
  /** ISO datetime with offset, e.g. "2026-07-25T19:00:00-04:00". */
  from_date: string;
  /** The meal type, incl. its naive default time ("18:00:00") — TZ-free. */
  meal_type?: { name?: string | null; time?: string | null } | null;
  meal_type_name?: string | null;
}

function baseUrl(serverUrl: string): string {
  return serverUrl.trim().replace(/\/+$/, '');
}
function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
}

/**
 * Verify the server is reachable and the token authenticates. Returns the
 * total recipe count Tandoor reports. Throws UnsafeUrlError for a private
 * serverUrl, or a descriptive Error otherwise.
 */
export async function testTandoorConnection(
  serverUrl: string,
  token: string,
): Promise<{ count: number }> {
  validatePublicUrl(serverUrl);
  const res = await safeFetch(`${baseUrl(serverUrl)}/api/recipe/?page_size=1`, {
    headers: authHeaders(token),
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error('Tandoor rejected the API token — check the token and that its scope includes `read`.');
  }
  if (!res.ok) {
    throw new Error(`Could not reach Tandoor: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as TandoorListResponse;
  return { count: data.count ?? 0 };
}

/** Page through /api/recipe/ collecting recipe ids (bounded). */
async function listRecipeIds(base: string, token: string): Promise<number[]> {
  const ids: number[] = [];
  let next: string | null = `${base}/api/recipe/?page_size=${PAGE_SIZE}`;
  let guard = 0;
  while (next && ids.length < MAX_RECIPES && guard < 200) {
    guard += 1;
    // safeFetch re-validates the URL each hop — important because `next` is a
    // server-supplied absolute URL, not something we constructed.
    const res: Response = await safeFetch(next, { headers: authHeaders(token) });
    if (!res.ok) {
      throw new Error(`Failed to list Tandoor recipes: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as TandoorListResponse;
    for (const r of data.results ?? []) {
      if (typeof r.id === 'number') ids.push(r.id);
    }
    next = data.next;
  }
  return ids.slice(0, MAX_RECIPES);
}

async function fetchRecipeDetail(base: string, token: string, id: number): Promise<TandoorRecipeDetail> {
  const res = await safeFetch(`${base}/api/recipe/${id}/`, { headers: authHeaders(token) });
  if (!res.ok) {
    throw new Error(`Failed to fetch Tandoor recipe ${id}: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as TandoorRecipeDetail;
}

/** Format a Tandoor numeric amount, dropping zeros/blanks and trailing zeros. */
function formatAmount(n: number | string | null | undefined): string {
  if (n == null) return '';
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (!Number.isFinite(num) || num === 0) return '';
  return String(Number(num.toFixed(3)));
}

/**
 * Flatten Tandoor's steps[].ingredients[] into Prism's ingredient lines.
 * Prism renders `{text}` and `{heading}` only, so structured amount/unit/food
 * is composed into a single display string per line.
 */
function normalizeIngredients(steps: TandoorStep[]): Array<{ text?: string; heading?: string }> {
  const out: Array<{ text?: string; heading?: string }> = [];
  for (const step of steps) {
    for (const ing of step.ingredients ?? []) {
      if (ing.is_header) {
        const heading = (ing.note || ing.food?.name || '').trim();
        if (heading) out.push({ heading });
        continue;
      }
      // Prefer the user's original typed line when Tandoor kept it.
      if (ing.original_text && ing.original_text.trim()) {
        out.push({ text: ing.original_text.trim() });
        continue;
      }
      const amount = ing.no_amount ? '' : formatAmount(ing.amount);
      const unit = (ing.unit?.name || '').trim();
      const food = (ing.food?.name || '').trim();
      const note = (ing.note || '').trim();
      const main = [amount, unit, food].filter(Boolean).join(' ').trim();
      const text = note ? (main ? `${main} (${note})` : note) : main;
      if (text) out.push({ text });
    }
  }
  return out;
}

/** Join Tandoor steps into one plain-text instructions block. */
function normalizeInstructions(steps: TandoorStep[]): string | null {
  const parts: string[] = [];
  for (const step of steps) {
    const instruction = (step.instruction || '').trim();
    if (!instruction) continue;
    const name = (step.name || '').trim();
    parts.push(name ? `${name}\n${instruction}` : instruction);
  }
  return parts.length ? parts.join('\n\n') : null;
}

/** Map a full Tandoor recipe detail into Prism's insert shape. */
export function normalizeTandoorRecipe(
  detail: TandoorRecipeDetail,
  serverUrl: string,
): NormalizedTandoorRecipe {
  const base = baseUrl(serverUrl);
  const steps = detail.steps ?? [];
  let remoteImageUrl: string | null = null;
  if (detail.image) {
    // Tandoor reports the image with its own configured origin (e.g.
    // http://localhost:8082/media/...), which the Prism server can't reach.
    // Re-anchor the media path onto the serverUrl the user connected with.
    let imagePath = detail.image;
    if (/^https?:\/\//i.test(imagePath)) {
      try {
        const u = new URL(imagePath);
        imagePath = u.pathname + u.search;
      } catch {
        /* fall through with the raw value */
      }
    }
    remoteImageUrl = `${base}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
  }
  const positive = (n: number | null | undefined) => (typeof n === 'number' && n > 0 ? n : null);
  return {
    externalId: String(detail.id),
    externalUpdatedAt: detail.updated_at ? new Date(detail.updated_at) : null,
    name: detail.name,
    description: (detail.description || '').trim() || null,
    url: `${base}/view/recipe/${detail.id}`,
    ingredients: normalizeIngredients(steps),
    instructions: normalizeInstructions(steps),
    prepTime: positive(detail.working_time),
    cookTime: positive(detail.waiting_time),
    servings: positive(detail.servings),
    tags: (detail.keywords ?? []).map((k) => (k.name || '').trim()).filter(Boolean),
    remoteImageUrl,
  };
}

/**
 * Fetch and normalize every recipe from a Tandoor server (bounded to
 * MAX_RECIPES). Individual recipe failures are skipped, not fatal.
 */
export async function fetchTandoorRecipes(
  serverUrl: string,
  token: string,
): Promise<{ recipes: NormalizedTandoorRecipe[]; total: number }> {
  validatePublicUrl(serverUrl);
  const base = baseUrl(serverUrl);
  const ids = await listRecipeIds(base, token);
  const recipes: NormalizedTandoorRecipe[] = [];
  for (const id of ids) {
    try {
      const detail = await fetchRecipeDetail(base, token, id);
      if (detail && detail.name) recipes.push(normalizeTandoorRecipe(detail, base));
    } catch (err) {
      console.error(`[tandoor] skipping recipe ${id}:`, err instanceof Error ? err.message : err);
    }
  }
  return { recipes, total: ids.length };
}

/**
 * Fetch all meal-plan entries from Tandoor (bounded). The endpoint is paginated
 * ({count,next,results}) but older/newer builds may return a bare array — both
 * are handled. safeFetch re-validates each server-supplied `next` URL (SSRF).
 */
export async function fetchTandoorMealPlan(
  serverUrl: string,
  token: string,
): Promise<TandoorMealPlanEntry[]> {
  validatePublicUrl(serverUrl);
  const base = baseUrl(serverUrl);
  const out: TandoorMealPlanEntry[] = [];
  let next: string | null = `${base}/api/meal-plan/?page_size=${PAGE_SIZE}`;
  let guard = 0;
  while (next && out.length < MAX_MEAL_PLAN && guard < 200) {
    guard += 1;
    const res: Response = await safeFetch(next, { headers: authHeaders(token) });
    if (!res.ok) {
      throw new Error(`Failed to list Tandoor meal plan: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as unknown;
    const results = Array.isArray(data)
      ? (data as TandoorMealPlanEntry[])
      : ((data as { results?: TandoorMealPlanEntry[] }).results ?? []);
    for (const e of results) {
      if (e && typeof e.id === 'number' && typeof e.from_date === 'string') out.push(e);
    }
    next = Array.isArray(data) ? null : ((data as { next?: string | null }).next ?? null);
  }
  return out.slice(0, MAX_MEAL_PLAN);
}

/**
 * Fetch + normalize a single Tandoor recipe by id. Used when a meal-plan entry
 * references a recipe that isn't imported yet (auto-import on apply). Returns
 * null if the recipe can't be fetched (never throws for a missing recipe).
 */
export async function fetchTandoorRecipeById(
  serverUrl: string,
  token: string,
  id: number,
): Promise<NormalizedTandoorRecipe | null> {
  validatePublicUrl(serverUrl);
  const base = baseUrl(serverUrl);
  try {
    const detail = await fetchRecipeDetail(base, token, id);
    if (detail && detail.name) return normalizeTandoorRecipe(detail, base);
  } catch (err) {
    console.error(`[tandoor] failed to fetch recipe ${id}:`, err instanceof Error ? err.message : err);
  }
  return null;
}

/**
 * Best-effort download of a Tandoor recipe image (Tandoor media may sit behind
 * auth or on an internal host, so we fetch server-side with the token rather
 * than storing a remote URL the browser couldn't load). Returns null on any
 * failure — a missing image never fails an import.
 */
export async function fetchTandoorImage(imageUrl: string, token: string): Promise<Buffer | null> {
  try {
    const res = await safeFetch(imageUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length ? buf : null;
  } catch {
    return null;
  }
}

export { UnsafeUrlError };
