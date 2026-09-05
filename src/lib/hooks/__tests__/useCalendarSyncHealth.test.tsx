/**
 * @jest-environment jsdom
 */
/**
 * The hook behind the "Sync paused" badge.
 *
 * The property worth pinning is the `enabled: false` path. The calendar widget
 * renders on the screensaver as well as the dashboard, and the screensaver runs
 * unattended for hours — so on that surface the hook must make no request at
 * all, not merely hide its answer. A silent all-night poll is the kind of thing
 * that gets added back by accident.
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCalendarSyncHealth } from '../useCalendarSyncHealth';

const respond = (body: unknown) =>
  jest.fn().mockResolvedValue({ ok: true, json: async () => body });

beforeEach(() => { jest.useRealTimers(); });
afterEach(() => { jest.restoreAllMocks(); });

describe('useCalendarSyncHealth', () => {
  it('reports a stalled sync once the check comes back', async () => {
    global.fetch = respond({ needsReauth: 3, providers: ['google'] }) as unknown as typeof fetch;

    const { result } = renderHook(() => useCalendarSyncHealth());

    await waitFor(() => expect(result.current.needsReauth).toBe(3));
    expect(result.current.stalled).toBe(true);
  });

  it('names the provider when only one has stalled', async () => {
    global.fetch = respond({ needsReauth: 2, providers: ['google'] }) as unknown as typeof fetch;

    const { result } = renderHook(() => useCalendarSyncHealth());

    await waitFor(() => expect(result.current.provider).toBe('Google'));
  });

  it('names no provider when several have stalled, rather than picking one', async () => {
    global.fetch = respond({ needsReauth: 2, providers: ['google', 'caldav'] }) as unknown as typeof fetch;

    const { result } = renderHook(() => useCalendarSyncHealth());

    await waitFor(() => expect(result.current.needsReauth).toBe(2));
    expect(result.current.provider).toBeNull();
  });

  it('names no provider for one it has no label for', async () => {
    global.fetch = respond({ needsReauth: 1, providers: ['some-new-provider'] }) as unknown as typeof fetch;

    const { result } = renderHook(() => useCalendarSyncHealth());

    await waitFor(() => expect(result.current.needsReauth).toBe(1));
    expect(result.current.provider).toBeNull();
  });

  it('makes no request at all when disabled', async () => {
    const fetchMock = respond({ needsReauth: 5, providers: ['google'] });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useCalendarSyncHealth({ enabled: false }));

    await act(async () => { await Promise.resolve(); });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.stalled).toBe(false);
  });

  it('keeps polling on the interval it was given', async () => {
    jest.useFakeTimers();
    const fetchMock = respond({ needsReauth: 0, providers: [] });
    global.fetch = fetchMock as unknown as typeof fetch;

    renderHook(() => useCalendarSyncHealth({ pollMs: 60_000 }));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => { jest.advanceTimersByTime(180_000); });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('holds the last known answer when a check fails, instead of flashing clear', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ needsReauth: 2, providers: ['google'] }) })
      .mockRejectedValue(new Error('offline'));
    global.fetch = fetchMock as unknown as typeof fetch;

    jest.useFakeTimers();
    const { result } = renderHook(() => useCalendarSyncHealth({ pollMs: 60_000 }));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.needsReauth).toBe(2);

    await act(async () => { jest.advanceTimersByTime(120_000); });
    expect(result.current.needsReauth).toBe(2);
  });
});
