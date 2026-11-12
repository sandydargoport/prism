/**
 * @jest-environment jsdom
 */
/**
 * The screensaver must always be dismissable, even where it never
 * auto-activates.
 *
 * The toolbar button opens the screensaver deliberately and is not gated on
 * PWA mode or on the timeout setting. Dismissal used to be registered in the
 * same effect as the idle timer, behind `if (timeout <= 0 || isPWA) return`,
 * so in an installed app — or with the timeout set to Never — the button
 * opened a screensaver that nothing could close.
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

/** The toolbar button's effect: open the screensaver on demand. */
const openScreensaver = () => window.dispatchEvent(new Event('prism:screensaver'));

/** A deliberate interaction, as the dismiss listeners see it. */
const tap = () => window.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

beforeEach(() => {
  mockIsPWA = false;
  mockTimeout = 120;
  window.localStorage.clear();
});

describe('useIdleDetection — dismissing what the button opened', () => {
  it('closes on a tap in an ordinary browser', () => {
    const { result } = renderHook(() => useIdleDetection());

    act(() => { openScreensaver(); });
    expect(result.current.isIdle).toBe(true);

    // First interaction clears the "forced" flag, the second dismisses — this
    // is deliberate, so the button's own mouseup doesn't close it instantly.
    act(() => { tap(); tap(); });
    expect(result.current.isIdle).toBe(false);
  });

  it('closes on a tap in an installed PWA, where the timer never runs', () => {
    // The regression: the app was stuck on the screensaver until force-closed.
    mockIsPWA = true;
    const { result } = renderHook(() => useIdleDetection());

    act(() => { openScreensaver(); });
    expect(result.current.isIdle).toBe(true);

    act(() => { tap(); tap(); });
    expect(result.current.isIdle).toBe(false);
  });

  it('closes on a tap when the timeout is set to Never', () => {
    // Same trap by a different route: "Never" also skipped registration.
    mockTimeout = 0;
    const { result } = renderHook(() => useIdleDetection());

    act(() => { openScreensaver(); });
    expect(result.current.isIdle).toBe(true);

    act(() => { tap(); tap(); });
    expect(result.current.isIdle).toBe(false);
  });

  it('leaves a keep-alive control alone rather than dismissing', () => {
    const keeper = document.createElement('button');
    keeper.setAttribute('data-screensaver-keep', '');
    document.body.appendChild(keeper);

    const { result } = renderHook(() => useIdleDetection());
    act(() => { openScreensaver(); });

    act(() => {
      keeper.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      keeper.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(result.current.isIdle).toBe(true);

    document.body.removeChild(keeper);
  });
});

describe('useIdleDetection — going idle by itself in an installed app (#1156)', () => {
  const NAMED = 'prism_display_named=1';
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    mockIsPWA = true;
    fetchMock = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    global.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    jest.useRealTimers();
    document.cookie = `${NAMED}; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  });

  const awayChecks = () => fetchMock.mock.calls.filter(([url]) => url === '/api/away-mode').length;

  it('never goes idle on a phone (an installed app that is not a named screen)', () => {
    const { result } = renderHook(() => useIdleDetection(60));
    act(() => { jest.advanceTimersByTime(61_000); });
    expect(result.current.isIdle).toBe(false);
    expect(awayChecks()).toBe(0);
  });

  it('goes idle after the timeout on a named screen, even as an installed app', () => {
    document.cookie = NAMED;
    const { result } = renderHook(() => useIdleDetection(60));
    act(() => { jest.advanceTimersByTime(59_000); });
    expect(result.current.isIdle).toBe(false);
    act(() => { jest.advanceTimersByTime(2_000); });
    expect(result.current.isIdle).toBe(true);
  });

  it('checks whether to start Away Mode on a named screen, even as an installed app', () => {
    document.cookie = NAMED;
    renderHook(() => useIdleDetection(60));
    expect(awayChecks()).toBe(1);
    act(() => { jest.advanceTimersByTime(60_000); });
    expect(awayChecks()).toBe(2);
  });
});
