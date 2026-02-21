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
