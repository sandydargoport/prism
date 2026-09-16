/**
 * @jest-environment jsdom
 */

/**
 * Tests for useCachedMountFetch — the rule that mounting is not, by itself,
 * a reason to go to the network.
 */

import { renderHook } from '@testing-library/react';
import { useCachedMountFetch } from '../useCachedMountFetch';
import { navCacheSet } from '@/lib/utils/navCache';

const FIVE_MINUTES = 5 * 60_000;

function mount(key: string, fetch: jest.Mock, adopt: jest.Mock, overrides = {}) {
  return renderHook(() =>
    useCachedMountFetch<string[]>({ key, maxAgeMs: FIVE_MINUTES, fetch, adopt, ...overrides })
  );
}

describe('useCachedMountFetch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('fetches when nothing is cached', () => {
    const fetch = jest.fn();
    const adopt = jest.fn();

    mount('/api/cold', fetch, adopt);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(adopt).not.toHaveBeenCalled();
  });

  it('reuses a value younger than one refresh interval instead of refetching', () => {
    navCacheSet('/api/warm', ['a']);
    jest.advanceTimersByTime(60_000);

    const fetch = jest.fn();
    const adopt = jest.fn();
    mount('/api/warm', fetch, adopt);

    expect(fetch).not.toHaveBeenCalled();
    expect(adopt).toHaveBeenCalledWith(['a']);
  });

  it('fetches once the cached value is older than one refresh interval', () => {
    navCacheSet('/api/stale', ['a']);
    jest.advanceTimersByTime(FIVE_MINUTES + 1000);

    const fetch = jest.fn();
    const adopt = jest.fn();
    mount('/api/stale', fetch, adopt);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(adopt).not.toHaveBeenCalled();
  });

  it('costs nothing to remount — the screensaver case', () => {
    const fetch = jest.fn();
    const adopt = jest.fn();

    // The dashboard's copy loads cold and fills the cache.
    const first = mount('/api/chores', fetch, adopt);
    expect(fetch).toHaveBeenCalledTimes(1);
    navCacheSet('/api/chores', ['sweep']);

    // Two minutes later the screensaver mounts its own copy of the widget.
    jest.advanceTimersByTime(2 * 60_000);
    fetch.mockClear();
    mount('/api/chores', fetch, adopt);

    expect(fetch).not.toHaveBeenCalled();
    expect(adopt).toHaveBeenCalledWith(['sweep']);
    first.unmount();
  });

  it('does nothing at all while disabled', () => {
    navCacheSet('/api/gated', ['a']);
    const fetch = jest.fn();
    const adopt = jest.fn();

    mount('/api/gated', fetch, adopt, { enabled: false });

    expect(fetch).not.toHaveBeenCalled();
    expect(adopt).not.toHaveBeenCalled();
  });

  it('always fetches for a hook that does not poll', () => {
    navCacheSet('/api/oneshot', ['a']);
    const fetch = jest.fn();
    const adopt = jest.fn();

    // maxAgeMs 0 means "no interval, so no window in which a cached value
    // counts as current".
    mount('/api/oneshot', fetch, adopt, { maxAgeMs: 0 });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(adopt).not.toHaveBeenCalled();
  });

  it('fetches again when the key changes to one that is not cached', () => {
    navCacheSet('/api/list?id=1', ['a']);
    const fetch = jest.fn();
    const adopt = jest.fn();

    const { rerender } = renderHook(
      ({ key }: { key: string }) =>
        useCachedMountFetch<string[]>({ key, maxAgeMs: FIVE_MINUTES, fetch, adopt }),
      { initialProps: { key: '/api/list?id=1' } }
    );
    expect(fetch).not.toHaveBeenCalled();

    rerender({ key: '/api/list?id=2' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
