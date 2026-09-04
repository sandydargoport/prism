/**
 * @jest-environment jsdom
 */
/**
 * Away Mode must not switch itself back on straight after a human switched it
 * off.
 *
 * Two separate faults combined to make it do exactly that:
 *
 *  1. `prism-last-activity` was only ever written from `resetTimer()`, which is
 *     registered behind `if (timeout <= 0 || isPWA) return`. On a display with
 *     the screensaver set to "Never" — or an installed PWA — the clock was
 *     written once and then frozen, so the client permanently believed the
 *     house had been empty for however long ago that was.
 *
 *  2. Auto-activation decided from that per-browser clock but wrote GLOBAL
 *     state. One neglected tab therefore re-enabled Away Mode for the whole
 *     house, within the 60s check interval, every time anyone dismissed it.
 *
 * Together they read to the user as "Away Mode comes on after 30 seconds even
 * though it is set to 24 hours" — and, because the screensaver yields to Away
 * Mode, as "the screensaver button does nothing".
 */
import { renderHook, act } from '@testing-library/react';

let mockIsPWA = false;
jest.mock('../useIsPWA', () => ({ useIsPWA: () => mockIsPWA }));

let mockTimeout = 120;
jest.mock('../useScreensaverTimeout', () => ({
  useScreensaverTimeout: () => ({ timeout: mockTimeout, setTimeout: jest.fn() }),
  SCREENSAVER_TIMEOUT_OPTIONS: [],
}));

import { useIdleDetection } from '../useIdleDetection';

const HOUR = 60 * 60 * 1000;
const LAST_ACTIVITY = 'prism-last-activity';

/** Whatever GET /api/away-mode should answer for this test. */
let serverState: Record<string, unknown> = { enabled: false, disabledAt: null };
let posted: Array<Record<string, unknown>> = [];

beforeEach(() => {
  mockIsPWA = false;
  mockTimeout = 120;
  window.localStorage.clear();
  posted = [];
  serverState = { enabled: false, disabledAt: null };
  global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'POST') {
      posted.push(JSON.parse(String(init.body)));
      return { ok: true, json: async () => ({}) } as Response;
    }
    return { ok: true, json: async () => serverState } as Response;
  }) as unknown as typeof fetch;
});

/** Let the immediate checkAwayMode() call run to completion. */
const settle = async () => {
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
};

describe('away mode auto-activation', () => {
  // Taps inside a data-screensaver-keep region — the calendar's own view
  // controls, which are operable while the screensaver is up — return early so
  // they do not dismiss the overlay. They are still somebody standing at the
  // display, and used to be the one kind of interaction that did not count as
  // activity at all.
  it('counts a tap inside a screensaver-keep region as activity', () => {
    window.localStorage.setItem('prism-screensaver-timeout', '0');
    const keep = document.createElement('div');
    keep.setAttribute('data-screensaver-keep', '');
    const inner = document.createElement('button');
    keep.appendChild(inner);
    document.body.appendChild(inner.parentElement!);

    renderHook(() => useIdleDetection());
    window.localStorage.setItem(LAST_ACTIVITY, String(Date.now() - 30 * HOUR));

    act(() => { inner.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });

    const stamp = Number(window.localStorage.getItem(LAST_ACTIVITY));
    expect(Date.now() - stamp).toBeLessThan(2000);
    document.body.innerHTML = '';
  });

  it('leaves the screensaver up when that tap lands in a keep region', () => {
    const keep = document.createElement('div');
    keep.setAttribute('data-screensaver-keep', '');
    const inner = document.createElement('button');
    keep.appendChild(inner);
    document.body.appendChild(keep);

    const { result } = renderHook(() => useIdleDetection());
    act(() => { window.dispatchEvent(new Event('prism:screensaver')); });
    expect(result.current.isIdle).toBe(true);

    act(() => { inner.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });

    expect(result.current.isIdle).toBe(true);
    document.body.innerHTML = '';
  });

  it('still arms after a genuinely long idle period', async () => {
    window.localStorage.setItem('prism-away-mode-timeout', '24');
    // "Never": the configuration in which the activity clock can actually go
    // stale, because nothing re-seeds it on mount.
    window.localStorage.setItem('prism-screensaver-timeout', '0');
    window.localStorage.setItem(LAST_ACTIVITY, String(Date.now() - 30 * HOUR));

    renderHook(() => useIdleDetection());
    await settle();

    expect(posted).toContainEqual({ enabled: true, autoActivated: true });
  });

  it('stands down after a human has just switched it off', async () => {
    window.localStorage.setItem('prism-away-mode-timeout', '24');
    // "Never": the configuration in which the activity clock can actually go
    // stale, because nothing re-seeds it on mount.
    window.localStorage.setItem('prism-screensaver-timeout', '0');
    // This client's own clock is stale — it has been sitting untouched.
    window.localStorage.setItem(LAST_ACTIVITY, String(Date.now() - 30 * HOUR));
    // But somebody turned Away Mode off at the wall display a moment ago.
    serverState = { enabled: false, disabledAt: new Date().toISOString() };

    renderHook(() => useIdleDetection());
    await settle();

    expect(posted).toHaveLength(0);
  });

  it('arms again once the switch-off is itself older than the timeout', async () => {
    window.localStorage.setItem('prism-away-mode-timeout', '24');
    // "Never": the configuration in which the activity clock can actually go
    // stale, because nothing re-seeds it on mount.
    window.localStorage.setItem('prism-screensaver-timeout', '0');
    window.localStorage.setItem(LAST_ACTIVITY, String(Date.now() - 30 * HOUR));
    serverState = { enabled: false, disabledAt: new Date(Date.now() - 30 * HOUR).toISOString() };

    renderHook(() => useIdleDetection());
    await settle();

    expect(posted).toContainEqual({ enabled: true, autoActivated: true });
  });

  it('does not re-post while away mode is already on', async () => {
    window.localStorage.setItem('prism-away-mode-timeout', '24');
    // "Never": the configuration in which the activity clock can actually go
    // stale, because nothing re-seeds it on mount.
    window.localStorage.setItem('prism-screensaver-timeout', '0');
    window.localStorage.setItem(LAST_ACTIVITY, String(Date.now() - 30 * HOUR));
    serverState = { enabled: true, disabledAt: null };

    renderHook(() => useIdleDetection());
    await settle();

    expect(posted).toHaveLength(0);
  });
});
