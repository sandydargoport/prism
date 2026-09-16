/**
 * Joining concurrent requests, and keeping the cache from growing forever.
 *
 * Both matter for the same reason: this runs on a wall display that is never
 * closed. Duplicate requests are cheap once and expensive ten thousand times,
 * and a cache that only evicts on read grows until something falls over.
 */
import {
  navCacheDedupe,
  navCacheInFlightCount,
  navCacheGet,
  navCacheSet,
  navCacheUpdate,
} from '../navCache';

describe('navCacheDedupe', () => {
  it('makes one request when two callers ask at the same moment', async () => {
    // The real case: the screensaver and the away-mode overlay are both
    // mounted on every page and ask for photos with identical parameters.
    let calls = 0;
    const fetcher = () => { calls++; return Promise.resolve('photos'); };

    const [a, b] = await Promise.all([
      navCacheDedupe('/api/photos?x=1', fetcher),
      navCacheDedupe('/api/photos?x=1', fetcher),
    ]);

    expect(calls).toBe(1);
    expect(a).toBe('photos');
    expect(b).toBe('photos');
  });

  it('keeps different URLs separate', async () => {
    let calls = 0;
    const fetcher = () => { calls++; return Promise.resolve(null); };
    await Promise.all([
      navCacheDedupe('/api/a', fetcher),
      navCacheDedupe('/api/b', fetcher),
    ]);
    expect(calls).toBe(2);
  });

  it('does not join a later caller once the first has finished', async () => {
    // It joins genuinely concurrent callers only. It is not a second cache.
    let calls = 0;
    const fetcher = () => { calls++; return Promise.resolve(null); };
    await navCacheDedupe('/api/seq', fetcher);
    await navCacheDedupe('/api/seq', fetcher);
    expect(calls).toBe(2);
  });

  it('shares a rejection with everyone waiting, and remembers nothing', async () => {
    // A failure must not be cached — the next attempt has to be able to
    // succeed, or one blip would stick until reload.
    let calls = 0;
    const failing = () => { calls++; return Promise.reject(new Error('down')); };

    const results = await Promise.allSettled([
      navCacheDedupe('/api/fail', failing),
      navCacheDedupe('/api/fail', failing),
    ]);
    expect(calls).toBe(1);
    expect(results.every((r) => r.status === 'rejected')).toBe(true);

    await navCacheDedupe('/api/fail', () => Promise.resolve('ok')).catch(() => {});
    expect(calls).toBe(1);
  });

  it('leaves nothing behind once requests settle', async () => {
    await navCacheDedupe('/api/clean', () => Promise.resolve(1));
    await navCacheDedupe('/api/clean2', () => Promise.reject(new Error('x'))).catch(() => {});
    expect(navCacheInFlightCount()).toBe(0);
  });
});

describe('navCache age windows', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('serves an entry to a reader willing to accept its age, and not to one that is not', () => {
    navCacheSet('/api/chores', ['sweep']);

    jest.advanceTimersByTime(3 * 60_000);

    // The default window is for seeding a render and has passed...
    expect(navCacheGet('/api/chores')).toBeUndefined();
    // ...but a hook polling every five minutes is not asking for anything
    // fresher than this.
    expect(navCacheGet('/api/chores', 5 * 60_000)).toEqual(['sweep']);
  });

  it('does not evict on behalf of the stricter reader', () => {
    navCacheSet('/api/chores', ['sweep']);
    jest.advanceTimersByTime(3 * 60_000);

    navCacheGet('/api/chores');

    expect(navCacheGet('/api/chores', 5 * 60_000)).toEqual(['sweep']);
  });

  it('refuses an entry past the hard ceiling however patient the reader', () => {
    navCacheSet('/api/chores', ['sweep']);

    jest.advanceTimersByTime(20 * 60_000);

    expect(navCacheGet('/api/chores', 60 * 60_000)).toBeUndefined();
  });
});

describe('navCacheUpdate', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('corrects the stored value without making it look newly fetched', () => {
    navCacheSet('/api/lists', [{ id: 'a', checked: false }]);

    jest.advanceTimersByTime(4 * 60_000);
    navCacheUpdate<{ id: string; checked: boolean }[]>('/api/lists', (lists) =>
      lists.map((item) => ({ ...item, checked: true }))
    );

    expect(navCacheGet('/api/lists', 5 * 60_000)).toEqual([{ id: 'a', checked: true }]);

    // Still four minutes old: a local correction is not a fetch.
    jest.advanceTimersByTime(2 * 60_000);
    expect(navCacheGet('/api/lists', 5 * 60_000)).toBeUndefined();
  });

  it('does nothing for a key that is not cached', () => {
    const update = jest.fn();
    navCacheUpdate('/api/absent', update);

    expect(update).not.toHaveBeenCalled();
    expect(navCacheGet('/api/absent')).toBeUndefined();
  });
});

describe('navCache bounded size', () => {
  it('evicts old entries instead of growing forever', () => {
    for (let i = 0; i < 150; i++) navCacheSet(`/api/item/${i}`, i);

    // The earliest are gone, the most recent are kept.
    expect(navCacheGet('/api/item/0')).toBeUndefined();
    expect(navCacheGet('/api/item/149')).toBe(149);
  });
});
