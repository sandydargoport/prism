/**
 * @jest-environment jsdom
 */
/**
 * Browser facts read through useSyncExternalStore rather than copied into
 * state after mount: a client-side mount has the real value on its FIRST
 * render, so nothing paints the default and then swaps. Each first-render
 * test records every render's value and checks the first one, which is the
 * render the old mount-effect versions got wrong.
 */
import { createElement } from 'react';
import { render, renderHook, act } from '@testing-library/react';
import { useIsTouch } from '../useIsTouch';
import { useReturnSlug } from '../useReturnSlug';
import { useOrigin } from '../useOrigin';
import { useAutoHideUI } from '../useAutoHideUI';
import { useHiddenCards } from '@/components/dashboard/useMobileCardOrder';

let pathname = '/';
jest.mock('next/navigation', () => ({ usePathname: () => pathname }));

/** Every value `useValue` returned, one entry per render. */
function rendersOf<T>(useValue: () => T): T[] {
  const seen: T[] = [];
  function Probe() {
    seen.push(useValue());
    return null;
  }
  render(createElement(Probe));
  return seen;
}

type Listener = (e: { matches: boolean }) => void;

/** A matchMedia whose answer the test can change. */
function fakeMatchMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<Listener>();
  window.matchMedia = ((query: string) => ({
    get matches() { return matches; },
    media: query,
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  })) as unknown as typeof window.matchMedia;
  return (next: boolean) => {
    matches = next;
    listeners.forEach((l) => l({ matches: next }));
  };
}

beforeEach(() => {
  pathname = '/';
  window.localStorage.clear();
  window.dispatchEvent(new StorageEvent('storage', { key: null }));
  window.history.replaceState(null, '', '/');
});

describe('useIsTouch', () => {
  it('is right on the first render and follows the media query', () => {
    const change = fakeMatchMedia(true);
    expect(rendersOf(useIsTouch)[0]).toBe(true);

    const { result } = renderHook(() => useIsTouch());
    act(() => change(false));
    expect(result.current).toBe(false);
  });
});

describe('useReturnSlug', () => {
  it('has the ?from= token on the first render', () => {
    pathname = '/settings';
    window.history.replaceState(null, '', '/settings?from=kitchen');
    expect(rendersOf(useReturnSlug)[0]).toBe('kitchen');
  });

  it('is null without a token', () => {
    window.history.replaceState(null, '', '/settings');
    expect(rendersOf(useReturnSlug)[0]).toBeNull();
  });
});

describe('useOrigin', () => {
  it('has the origin on the first render', () => {
    expect(rendersOf(useOrigin)[0]).toBe(window.location.origin);
  });
});

describe('useAutoHideUI', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('starts visible when turned back on after it had hidden the UI', () => {
    const { result } = renderHook(() => useAutoHideUI());
    act(() => result.current.setAutoHideEnabled(true));
    act(() => { jest.advanceTimersByTime(10_000); });
    expect(result.current.uiHidden).toBe(true);

    act(() => result.current.setAutoHideEnabled(false));
    expect(result.current.uiHidden).toBe(false);
    act(() => result.current.setAutoHideEnabled(true));
    expect(result.current.uiHidden).toBe(false);

    // ...and hides again after a fresh countdown.
    act(() => { jest.advanceTimersByTime(10_000); });
    expect(result.current.uiHidden).toBe(true);
  });
});

describe('useHiddenCards', () => {
  it('a card toggled in the FAB menu reaches the mobile dashboard without a reload', () => {
    // Two hooks on one page: the FAB menu and the dashboard it controls.
    const fab = renderHook(() => useHiddenCards());
    const dashboard = renderHook(() => useHiddenCards());
    expect(dashboard.result.current[0]).toEqual(['clock', 'photos']);

    act(() => fab.result.current[1]((prev) => [...prev, 'weather']));
    expect(dashboard.result.current[0]).toEqual(['clock', 'photos', 'weather']);
  });

  it('reads what is stored on the first render', () => {
    window.localStorage.setItem('prism-mobile-hidden-cards', JSON.stringify(['meals']));
    expect(rendersOf(() => useHiddenCards()[0])[0]).toEqual(['meals']);
  });
});
