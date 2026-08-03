'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useVisibilityPolling } from '@/lib/hooks/useVisibilityPolling';
import { navCacheGet, navCacheSet } from '@/lib/utils/navCache';

export type PhotoOrientation = 'landscape' | 'portrait' | 'square';
export type PhotoUsageTag = 'wallpaper' | 'gallery' | 'screensaver';

export interface Photo {
  id: string;
  sourceId: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  takenAt: string | null;
  externalId: string | null;
  thumbnailPath: string | null;
  favorite: boolean;
  orientation: PhotoOrientation | null;
  usage: string; // comma-separated tags: "wallpaper,screensaver"
  createdAt: string;
}

/** Parse usage string into array of tags */
export function parseUsageTags(usage: string): PhotoUsageTag[] {
  if (!usage) return [];
  return usage.split(',').filter((t): t is PhotoUsageTag =>
    ['wallpaper', 'gallery', 'screensaver'].includes(t)
  );
}

/** Check if photo has a specific usage tag */
export function hasUsageTag(usage: string, tag: PhotoUsageTag): boolean {
  return usage.split(',').includes(tag);
}

/**
 * Returns resolution quality indicator: 'green' (>= target), 'yellow' (>= 75% target), 'red' (< 75%)
 */
export function getResolutionQuality(
  width: number | null,
  height: number | null,
  targetWidth = 1920,
  targetHeight = 1080,
): 'green' | 'yellow' | 'red' {
  if (!width || !height) return 'red';
  const targetPixels = targetWidth * targetHeight;
  const photoPixels = width * height;
  if (photoPixels >= targetPixels) return 'green';
  if (photoPixels >= targetPixels * 0.75) return 'yellow';
  return 'red';
}

interface UsePhotosOptions {
  sourceId?: string;
  favorite?: boolean;
  usage?: string; // single tag to filter by (e.g., 'wallpaper'), matched against comma-separated field
  orientation?: PhotoOrientation;
  belowHd?: boolean; // only photos under 1920×1080 (sub-green resolution)
  sort?: 'random' | 'chronological';
  limit?: number;
  refreshInterval?: number;
}

interface UsePhotosResult {
  photos: Photo[];
  loading: boolean;
  error: string | null;
  total: number;
  refresh: () => Promise<void>;
  loadMore: () => void;
  toggleFavorite: (photoId: string, favorite: boolean) => Promise<void>;
  updateUsage: (photoId: string, usage: string) => Promise<void>;
}

export function usePhotos(options: UsePhotosOptions = {}): UsePhotosResult {
  const {
    sourceId,
    favorite,
    usage,
    orientation,
    belowHd,
    sort = 'chronological',
    limit = 50,
    refreshInterval = 0,
  } = options;

  // Cache key for page-0 fetch — used to seed initial state on revisit
  const cacheKey = useMemo(() => {
    const params = new URLSearchParams();
    if (sourceId) params.set('sourceId', sourceId);
    if (favorite !== undefined) params.set('favorite', String(favorite));
    if (usage) params.set('usage', usage);
    if (orientation) params.set('orientation', orientation);
    if (belowHd) params.set('belowHd', 'true');
    params.set('sort', sort);
    params.set('limit', String(limit));
    params.set('offset', '0');
    return `/api/photos?${params}`;
  }, [sourceId, favorite, usage, orientation, belowHd, sort, limit]);

  const cached = navCacheGet<{ photos: Photo[]; total: number }>(cacheKey);
  const [photos, setPhotos] = useState<Photo[]>(() => cached?.photos ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(() => cached?.total ?? 0);
  const offsetRef = useRef(0);

  const fetchPhotos = useCallback(async (requestOffset = 0, append = false) => {
    try {
      setError(null);
      // Only show spinner on true cache misses — skip for SWR background refresh
      if (!append && !navCacheGet(cacheKey)) setLoading(true);
      const params = new URLSearchParams();
      if (sourceId) params.set('sourceId', sourceId);
      if (favorite !== undefined) params.set('favorite', String(favorite));
      if (usage) params.set('usage', usage);
      if (orientation) params.set('orientation', orientation);
      if (belowHd) params.set('belowHd', 'true');
      params.set('sort', sort);
      params.set('limit', String(limit));
      params.set('offset', String(requestOffset));

      const response = await fetch(`/api/photos?${params}`);
      if (!response.ok) throw new Error('Failed to fetch photos');

      const data = await response.json();
      if (append) {
        setPhotos((prev) => [...prev, ...data.photos]);
      } else {
        navCacheSet(cacheKey, { photos: data.photos, total: data.total });
        setPhotos(data.photos);
      }
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch photos');
    } finally {
      setLoading(false);
    }
  }, [sourceId, favorite, usage, orientation, belowHd, sort, limit, cacheKey]);

  const loadMore = useCallback(() => {
    const newOffset = offsetRef.current + limit;
    offsetRef.current = newOffset;
    fetchPhotos(newOffset, true);
  }, [limit, fetchPhotos]);

  const refresh = useCallback(async () => {
    offsetRef.current = 0;
    await fetchPhotos(0, false);
  }, [fetchPhotos]);

  const toggleFavorite = useCallback(async (photoId: string, fav: boolean) => {
    try {
      const response = await fetch(`/api/photos/${photoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorite: fav }),
      });
      if (!response.ok) throw new Error('Failed to update photo');
      setPhotos((prev) =>
        prev.map((p) => (p.id === photoId ? { ...p, favorite: fav } : p))
      );
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  }, []);

  const updateUsage = useCallback(async (photoId: string, newUsage: string) => {
    try {
      const response = await fetch(`/api/photos/${photoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usage: newUsage }),
      });
      if (!response.ok) throw new Error('Failed to update photo');
      setPhotos((prev) =>
        prev.map((p) => (p.id === photoId ? { ...p, usage: newUsage } : p))
      );
    } catch (err) {
      console.error('Error updating usage:', err);
    }
  }, []);

  useEffect(() => {
    offsetRef.current = 0;
    fetchPhotos(0, false);
  }, [fetchPhotos]);

  // Stable wrapper so useVisibilityPolling gets a memoized callback
  const pollPhotos = useCallback(() => { fetchPhotos(0, false); }, [fetchPhotos]);

  // Periodic refresh — pauses when tab is hidden
  useVisibilityPolling(pollPhotos, refreshInterval);

  return { photos, loading, error, total, refresh, loadMore, toggleFavorite, updateUsage };
}
