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

describe('navCache bounded size', () => {
  it('evicts old entries instead of growing forever', () => {
    for (let i = 0; i < 150; i++) navCacheSet(`/api/item/${i}`, i);

    // The earliest are gone, the most recent are kept.
    expect(navCacheGet('/api/item/0')).toBeUndefined();
    expect(navCacheGet('/api/item/149')).toBe(149);
  });
});
