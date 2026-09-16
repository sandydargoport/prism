/**
 * Module-level stale-while-revalidate cache for client-side navigation.
 *
 * Keys are API URLs. On navigation away and back, cached data is returned
 * immediately as initial state so pages render without a loading skeleton.
 *
 * Every entry carries the time it was stored, and the reader says how old a
 * value it is willing to accept. Two readers want different things from the
 * same entry:
 *
 * - *Seed this render.* Default, 60s — long enough to survive a subpage visit
 *   and return, short enough that a longer session still shows fresh data.
 * - *Decide whether to fetch at all.* A polling hook passes its own refresh
 *   interval, because a value younger than one interval is exactly as fresh as
 *   what that hook would be showing had it never unmounted. That is what makes
 *   a remount stop being a refetch.
 *
 * A stale read therefore does not delete the entry: it is only stale for that
 * reader. Entries leave on the size cap, or once past MAX_AGE_MS, whichever
 * comes first.
 */

const store = new Map<string, { data: unknown; ts: number }>();
const TTL_MS = 60_000;

/**
 * Oldest an entry can be and still be served to anyone. Bounds how far a
 * caller's maxAge can reach, so a long poll interval (or a wall display left
 * alone overnight) cannot resurrect something from hours ago.
 */
const MAX_AGE_MS = 15 * 60_000;

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

/**
 * The value stored for `key`, if it is younger than `maxAgeMs`.
 *
 * @param maxAgeMs How old a value the caller will accept. Capped at
 *   MAX_AGE_MS. Defaults to the 60s render-seeding window.
 */
export function navCacheGet<T>(key: string, maxAgeMs: number = TTL_MS): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  const age = Date.now() - entry.ts;
  if (age > MAX_AGE_MS) {
    store.delete(key);
    return undefined;
  }
  if (age > maxAgeMs) return undefined;
  return entry.data as T;
}

/**
 * Apply a local correction to a cached value without changing its age.
 *
 * For the optimistic-update path: the mutation has been accepted by the
 * server, so the cached copy is now wrong in a way a refetch would only
 * confirm. Writing the correction through keeps the entry usable — the age is
 * deliberately left alone, since nothing new was fetched.
 *
 * Does nothing when the key is absent: there is no value to correct, and
 * inventing one would cache a partial payload.
 */
export function navCacheUpdate<T>(key: string, update: (current: T) => T): void {
  const entry = store.get(key);
  if (!entry) return;
  store.set(key, { data: update(entry.data as T), ts: entry.ts });
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
