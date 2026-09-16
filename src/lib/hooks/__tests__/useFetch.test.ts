/**
 * @jest-environment jsdom
 */

/**
 * Tests for useFetch's request coordination: what a remount costs, and what
 * several live instances of the same endpoint cost between them.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useFetch } from '../useFetch';
import { navCacheSet } from '@/lib/utils/navCache';

const URL = '/api/mode';

function jsonOnce(value: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(value) } as Response);
}

describe('useFetch', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn(() => jsonOnce({ enabled: false }));
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const mount = () =>
    renderHook(() =>
      useFetch<{ enabled: boolean }>({
        url: URL,
        initialData: { enabled: false },
        refreshInterval: 60_000,
      })
    );

  it('fetches on a cold mount', async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('serves a second instance of the same endpoint without a second request', async () => {
    const first = mount();
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    fetchMock.mockClear();

    const second = mount();
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(second.result.current.data).toEqual({ enabled: false });
  });

  it('skips a poll when another instance has just fetched, and polls when none has', async () => {
    jest.useFakeTimers();
    const { result } = mount();
    // Let the mount fetch settle before any timer runs.
    await act(async () => {});
    fetchMock.mockClear();

    // Nobody else has asked: the poll goes to the network as usual.
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Ten seconds before the next tick, another live instance of this endpoint
    // fetches it. This one's poll has nothing to add.
    await act(async () => {
      jest.advanceTimersByTime(50_000);
      navCacheSet(URL, { enabled: true });
      jest.advanceTimersByTime(10_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual({ enabled: true });
    jest.useRealTimers();
  });

  it('still goes to the network for an explicit refresh', async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.loading).toBe(false));
    fetchMock.mockClear();

    await act(async () => {
      await result.current.refresh();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
