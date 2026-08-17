'use client';

import { useState, useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { useVisibilityPolling } from './useVisibilityPolling';
import { navCacheGet, navCacheSet } from '@/lib/utils/navCache';

interface UseFetchOptions<T> {
  url: string;
  initialData: T;
  transform?: (json: unknown) => T;
  refreshInterval?: number;
  label?: string;
  /** When false, skip initial fetch and polling. Fetch triggers when enabled transitions to true. */
  enabled?: boolean;
}

interface UseFetchResult<T> {
  data: T;
  setData: Dispatch<SetStateAction<T>>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useFetch<T>(options: UseFetchOptions<T>): UseFetchResult<T> {
  const { url, initialData, transform, refreshInterval = 0, label = 'data', enabled = true } = options;

  const transformRef = useRef(transform);
  transformRef.current = transform;
  const labelRef = useRef(label);
  labelRef.current = label;

  // Seed state from navigation cache so the page renders immediately on revisit
  const cached = navCacheGet<T>(url);
  const [data, setData] = useState<T>(() => cached ?? initialData);
  // Only show loading spinner on true cold fetches (no cached data available)
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  // The URL we've already loaded data for. Used to keep background POLLS silent
  // (stale-while-revalidate) — the spinner is only for a cold first load of a
  // URL. We can't rely on navCache for this: its TTL is 60s, far shorter than
  // poll intervals (minutes), so on every poll the cache is already gone and the
  // widget would blank. Reset implicitly when the URL changes (new endpoint =
  // cold load), preserving the spinner on filter/param changes.
  const loadedUrlRef = useRef<string | null>(cached ? url : null);

  const fetchData = useCallback(async () => {
    // Spinner only on a cold first load of this URL; background polls keep the
    // current data on screen instead of blanking every widget.
    if (loadedUrlRef.current !== url && !navCacheGet(url)) setLoading(true);
    try {
      setError(null);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch ${labelRef.current}`);
      const json = await response.json();
      const result = transformRef.current ? transformRef.current(json) : (json as T);
      navCacheSet(url, result);
      loadedUrlRef.current = url;
      // Structural-shared polling: when the new payload is byte-identical
      // to what's already in state, return the previous reference so React
      // skips re-renders for every consumer of this data. Big win on weak
      // hardware where most polls return unchanged data (weather, calendar
      // hours past, finished chores, etc.).
      setData((prev) => {
        try {
          return JSON.stringify(prev) === JSON.stringify(result) ? prev : result;
        } catch {
          return result;
        }
      });
    } catch (err) {
      console.error(`Error fetching ${labelRef.current}:`, err);
      setError(err instanceof Error ? err.message : `Failed to fetch ${labelRef.current}`);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (enabled) fetchData();
  }, [fetchData, enabled]);

  useVisibilityPolling(fetchData, enabled ? refreshInterval : 0);

  return { data, setData, loading, error, refresh: fetchData };
}
