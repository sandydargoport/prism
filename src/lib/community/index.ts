/**
 * Community layout loader — runtime fetch from GitHub, no rebuild needed.
 */

import type { CommunityIndexEntry, CommunityLayoutData } from './validateLayout';

export interface CommunityIndex {
  version: number;
  layouts: CommunityIndexEntry[];
}

export interface CommunityFilterOptions {
  mode?: 'dashboard' | 'screensaver';
  screenSize?: string;
  orientation?: 'landscape' | 'portrait';
  tags?: string[];
  search?: string;
}

const GITHUB_RAW_BASE =
  'https://raw.githubusercontent.com/sandydargoport/prism/master/community/layouts/';

const INDEX_TTL_MS = 60 * 60 * 1000; // 1 hour

let indexCache: { data: CommunityIndex; fetchedAt: number } | null = null;

const layoutCache = new Map<string, CommunityLayoutData>();

/**
 * Fetch the community layout index from GitHub with a 1-hour TTL cache.
 */
export async function getCommunityIndex(): Promise<CommunityIndex> {
  const now = Date.now();
  if (indexCache && now - indexCache.fetchedAt < INDEX_TTL_MS) {
    return indexCache.data;
  }

  try {
    const resp = await fetch(GITHUB_RAW_BASE + 'index.json', {
      cache: 'no-store',
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = (await resp.json()) as CommunityIndex;
    indexCache = { data, fetchedAt: now };
    return data;
  } catch {
    // Return cached data if available, otherwise empty fallback
    if (indexCache) return indexCache.data;
    return { version: 1, layouts: [] };
  }
}

/**
 * Fetch a community layout by its file path from GitHub.
 */
export async function getCommunityLayout(file: string): Promise<CommunityLayoutData | null> {
  if (layoutCache.has(file)) {
    return layoutCache.get(file)!;
  }

  try {
    const resp = await fetch(GITHUB_RAW_BASE + file, {
      cache: 'no-store',
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as CommunityLayoutData;
    layoutCache.set(file, data);
    return data;
  } catch {
    return null;
  }
}

/**
 * Filter community layouts by criteria (client-side).
 */
export async function filterCommunityLayouts(
  filters: CommunityFilterOptions = {},
): Promise<CommunityIndexEntry[]> {
  const index = await getCommunityIndex();
  let layouts = index.layouts;

  if (filters.mode) {
    layouts = layouts.filter(l => l.mode === filters.mode);
  }

  if (filters.screenSize) {
    layouts = layouts.filter(l => l.screenSizes.includes(filters.screenSize!));
  }

  if (filters.orientation) {
    layouts = layouts.filter(l => l.orientation === filters.orientation);
  }

  if (filters.tags && filters.tags.length > 0) {
    layouts = layouts.filter(l =>
      filters.tags!.some(tag => l.tags.includes(tag))
    );
  }

  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    layouts = layouts.filter(l =>
      l.name.toLowerCase().includes(searchLower) ||
      l.description.toLowerCase().includes(searchLower) ||
      l.tags.some(t => t.toLowerCase().includes(searchLower))
    );
  }

  return layouts;
}

// ---------------------------------------------------------------------------
// Themes
//
// A second index rather than a new shape for the existing one. The raw URL
// below is pinned to master and baked into every deployed client, so a change
// to layouts/index.json would break instances that have not updated. An
// additional file cannot.
// ---------------------------------------------------------------------------

const THEMES_RAW_BASE =
  'https://raw.githubusercontent.com/sandydargoport/prism/master/community/themes/';

export interface CommunityThemeIndexEntry {
  id: string;
  file: string;
  name: string;
  description: string;
  author: string;
  tags: string[];
  createdAt: string;
  /** Pairs that are legible but tiring. Shown so the installer can judge. */
  contrastWarnings: number;
}

export interface CommunityThemeIndex {
  version: number;
  themes: CommunityThemeIndexEntry[];
}

let themeIndexCache: { data: CommunityThemeIndex; fetchedAt: number } | null = null;

/** Bounded, unlike the layout cache — a display runs for weeks. */
const themeCache = new Map<string, unknown>();
const MAX_CACHED_THEMES = 40;

export async function getCommunityThemeIndex(): Promise<CommunityThemeIndex> {
  const now = Date.now();
  if (themeIndexCache && now - themeIndexCache.fetchedAt < INDEX_TTL_MS) {
    return themeIndexCache.data;
  }
  try {
    const res = await fetch(`${THEMES_RAW_BASE}index.json`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as CommunityThemeIndex;
    themeIndexCache = { data, fetchedAt: now };
    return data;
  } catch {
    // Stale beats empty: a gallery that blanks on a flaky connection looks
    // like the feature broke.
    if (themeIndexCache) return themeIndexCache.data;
    return { version: 1, themes: [] };
  }
}

export async function getCommunityTheme(file: string): Promise<unknown | null> {
  const cached = themeCache.get(file);
  if (cached) return cached;
  try {
    const res = await fetch(`${THEMES_RAW_BASE}${file}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    themeCache.set(file, data);
    while (themeCache.size > MAX_CACHED_THEMES) {
      const oldest = themeCache.keys().next().value;
      if (oldest === undefined) break;
      themeCache.delete(oldest);
    }
    return data;
  } catch {
    return null;
  }
}
