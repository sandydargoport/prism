/**
 * Module-level stale-while-revalidate cache for client-side navigation.
 *
 * Keys are API URLs. On navigation away and back, cached data is returned
 * immediately as initial state so pages render without a loading skeleton.
 * The fetch still runs in the background and updates state when it resolves.
 *
 * TTL is intentionally short (60s) — just long enough to survive a typical
 * subpage visit and return, while still showing fresh data on longer sessions.
 */

const store = new Map<string, { data: unknown; ts: number }>();
const TTL_MS = 60_000;

/**
 * Cap on stored entries. Eviction was previously lazy — an entry only went
 * when a read found it stale — so any URL that stopped being read was never
 * freed. On a wall display left running for weeks that grows without bound,
 * and a calendar payload can hold 500 events.
 */
const MAX_ENTRIES = 100;

/**
 * Requests currently in flight, keyed the same way as the cache.
 *
 * Without this, two components asking for the same URL at the same moment make
 * two requests; the cache only helps once one has already returned. That is not
 * hypothetical — the screensaver and the away-mode overlay are both mounted on
 * every page and ask for photos with byte-identical parameters.
 */
const inFlight = new Map<string, Promise<unknown>>();

export function navCacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > TTL_MS) {
    store.delete(key);
    return undefined;
  }
  return entry.data as T;
}

export function navCacheSet(key: string, data: unknown): void {
  store.set(key, { data, ts: Date.now() });
  // Oldest-inserted first. Map preserves insertion order, and re-setting a key
  // does not move it — so a hot key can still be evicted. Acceptable: the cost
  // is one refetch, and a strict LRU would mean touching the map on every read.
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

/**
 * Run `fetcher` for `key`, or join the request already running for it.
 *
 * The entry is removed as soon as the promise settles, so this only ever joins
 * genuinely concurrent callers — it is not a second cache with its own
 * lifetime, and a failure is not remembered.
 */
export function navCacheDedupe<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fetcher().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}

/** Visible for tests. */
export function navCacheInFlightCount(): number {
  return inFlight.size;
}

/** Invalidate all keys matching a regex — call after mutations. */
export function navCacheInvalidate(pattern: RegExp): void {
  for (const key of store.keys()) {
    if (pattern.test(key)) store.delete(key);
  }
}
