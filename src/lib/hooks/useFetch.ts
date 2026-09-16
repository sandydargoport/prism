'use client';

import { useState, useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import { useVisibilityPolling } from './useVisibilityPolling';
import { usePollingInterval } from './usePollingInterval';
import { useCachedMountFetch } from './useCachedMountFetch';
import { navCacheGet, navCacheSet, navCacheDedupe } from '@/lib/utils/navCache';

interface UseFetchOptions<T> {
  url: string;
  initialData: T;
  transform?: (json: unknown) => T;
  refreshInterval?: number;
  label?: string;
  /** When false, skip initial fetch and polling. Fetch triggers when enabled transitions to true. */
  enabled?: boolean;
  /** Keep polling while the screensaver is up. See useVisibilityPolling. */
  pollWhileIdle?: boolean;
}

/**
 * How much of a refresh interval may have passed and a value another instance
 * fetched still stand in for this one's own poll.
 *
 * The same endpoint is commonly asked for by several live hooks at once — both
 * mode toggles are read by their overlay and by the Screensaver, and every
 * widget the screensaver draws has a twin on the dashboard behind it. Their
 * timers are staggered by whenever each mounted, so request dedupe never
 * catches them: they are sequential, not concurrent. Three instances of a
 * 60-second poll therefore made a request every twenty seconds.
 *
 * A half-interval keeps that safe from the other direction. The first instance
 * to tick after a full interval has elapsed always sees a value older than
 * this and goes to the network, so the data still refreshes on schedule — what
 * stops is the other two asking again straight after it.
 */
const POLL_REUSE_RATIO = 0.5;

interface UseFetchResult<T> {
  data: T;
  setData: Dispatch<SetStateAction<T>>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useFetch<T>(options: UseFetchOptions<T>): UseFetchResult<T> {
  const { url, initialData, transform, refreshInterval = 0, label = 'data', enabled = true, pollWhileIdle = false } = options;

  const transformRef = useRef(transform);
  transformRef.current = transform;
  const labelRef = useRef(label);
  labelRef.current = label;

  // How old a cached value may be and still be treated as current: one refresh
  // interval, since that is already the staleness this hook polls at.
  const maxAgeMs = usePollingInterval(refreshInterval);

  // Seed state from navigation cache so the page renders immediately on revisit
  const cached = navCacheGet<T>(url, maxAgeMs);
  const [data, setData] = useState<T>(() => cached ?? initialData);
  // Only show loading spinner on true cold fetches (no cached data available)
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  // The URL we've already loaded data for. Used to keep background POLLS silent
  // (stale-while-revalidate) — the spinner is only for a cold first load of a
  // URL. We can't rely on navCache for this: a poll fires exactly when the
  // cached value has aged past one interval, so at that moment the cache never
  // has an answer and every widget would blank. Reset implicitly when the URL
  // changes (new endpoint = cold load), preserving the spinner on filter/param
  // changes.
  const loadedUrlRef = useRef<string | null>(cached ? url : null);

  // Structural-shared updates: when the new payload is byte-identical to
  // what's already in state, keep the previous reference so React skips
  // re-renders for every consumer of this data. Big win on weak hardware where
  // most polls return unchanged data (weather, calendar hours past, finished
  // chores, etc.), and it is what makes adopting a cached value on remount
  // free rather than one more render.
  const applyResult = useCallback((result: T) => {
    loadedUrlRef.current = url;
    setData((prev) => {
      try {
        return JSON.stringify(prev) === JSON.stringify(result) ? prev : result;
      } catch {
        return result;
      }
    });
    setLoading(false);
  }, [url]);

  const fetchData = useCallback(async (opts?: { force?: boolean }) => {
    // Somebody else may have just fetched this. Explicit refreshes — a
    // mutation, a pull-to-refresh, a sync event — always go to the network,
    // because they are asking about a change the cache cannot know about yet.
    if (!opts?.force && maxAgeMs > 0) {
      const justFetched = navCacheGet<T>(url, maxAgeMs * POLL_REUSE_RATIO);
      if (justFetched !== undefined) {
        applyResult(justFetched);
        return;
      }
    }
    // Spinner only on a cold first load of this URL; background polls keep the
    // current data on screen instead of blanking every widget.
    if (loadedUrlRef.current !== url && !navCacheGet(url, maxAgeMs)) setLoading(true);
    try {
      setError(null);
      // Joined rather than duplicated: two components polling the same URL on
      // the same tick make one request. The transform runs per consumer, since
      // two callers of the same endpoint can shape the response differently.
      const json = await navCacheDedupe(url, async () => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch ${labelRef.current}`);
        return response.json();
      });
      const result = transformRef.current ? transformRef.current(json as never) : (json as T);
      navCacheSet(url, result);
      applyResult(result);
    } catch (err) {
      console.error(`Error fetching ${labelRef.current}:`, err);
      setError(err instanceof Error ? err.message : `Failed to fetch ${labelRef.current}`);
    } finally {
      setLoading(false);
    }
  }, [url, maxAgeMs, applyResult]);

  useCachedMountFetch<T>({
    key: url,
    enabled,
    maxAgeMs,
    fetch: fetchData,
    adopt: applyResult,
  });

  useVisibilityPolling(fetchData, enabled ? refreshInterval : 0, { pollWhileIdle });

  const refresh = useCallback(() => fetchData({ force: true }), [fetchData]);

  return { data, setData, loading, error, refresh };
}
