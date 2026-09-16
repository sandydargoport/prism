'use client';

import { useEffect, useRef } from 'react';
import { navCacheGet } from '@/lib/utils/navCache';

interface CachedMountFetchOptions<T> {
  /** Cache key, which for every caller is also the request URL. */
  key: string;
  /** False skips both the cache read and the fetch, as the callers' `enabled` does. */
  enabled?: boolean;
  /**
   * How old a cached value may be and still count as current — the hook's own
   * refresh interval, already stretched by usePollingInterval so Performance
   * Mode widens this with everything else. 0 disables reuse and always fetches.
   *
   * Passed in rather than derived here because the caller needs the same
   * number to seed its initial state from the cache. Deriving it twice would
   * let the two drift, and the widget would paint empty for a frame before
   * adopting a value it could have rendered immediately.
   */
  maxAgeMs: number;
  /** Go to the network. Read at call time, so it need not be memoized. */
  fetch: () => void | Promise<void>;
  /** Put a reused value into state. Must leave the hook as a completed fetch would. */
  adopt: (cached: T) => void;
}

/**
 * Fetch on mount, unless the shared cache already holds a recent enough value.
 *
 * Mounting is not a reason to go to the network. A polling hook has already
 * accepted that its data can be up to one refresh interval old, so a cached
 * value younger than that is exactly as fresh as what the hook would have been
 * showing had it never unmounted — there is nothing for a request to add.
 *
 * On a wall display this is most of the win: the screensaver renders its own
 * copies of the widgets from the registry, so every idle cycle mounts a second
 * full set of data hooks and every one of them used to cold-load. They now
 * read what the dashboard's copies last fetched.
 *
 * Polling and explicit refreshes are untouched and always hit the network,
 * which keeps this to the one question it should answer: has enough changed
 * since the last fetch to be worth a request, not who is asking.
 */
export function useCachedMountFetch<T>({
  key,
  enabled = true,
  maxAgeMs,
  fetch,
  adopt,
}: CachedMountFetchOptions<T>): void {
  const fetchRef = useRef(fetch);
  fetchRef.current = fetch;
  const adoptRef = useRef(adopt);
  adoptRef.current = adopt;

  useEffect(() => {
    if (!enabled) return;
    // Keyed on the URL rather than the fetch callback: every caller derives
    // both from the same params, and the callback's identity changes for
    // reasons the request does not care about.
    const cached = maxAgeMs > 0 ? navCacheGet<T>(key, maxAgeMs) : undefined;
    if (cached !== undefined) {
      adoptRef.current(cached);
      return;
    }
    void fetchRef.current();
  }, [key, enabled, maxAgeMs]);
}
