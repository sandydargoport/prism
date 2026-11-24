/**
 * @jest-environment jsdom
 *
 * The dock on a dashboard follows this screen's Auto-hide navigation (#1232).
 * On, it tucks behind the Menu tab and goes ten seconds after a touch (#922).
 * Off, it stays on screen as on every other page, and the page keeps its room.
 * A screen that never chose follows the household, and stays tucked until the
 * household's answer is in, so a screen that hides never shows the dock first.
 */
import { render, act, fireEvent } from '@testing-library/react';

let householdScenery: boolean | null = false;
let mobile = false;
let settingsAnswer: Promise<unknown> = Promise.resolve();

jest.mock('next-intl', () => ({ useTranslations: () => (_k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? _k }));
jest.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/lib/hooks/useIsMobile', () => ({ useIsMobile: () => mobile }));
jest.mock('@/components/screensaver/calmMode', () => ({ useCalmIdle: () => false }));
jest.mock('@/lib/hooks/useHiddenPages', () => ({ useHiddenPages: () => ({ filterNavItems: <T,>(i: T) => i, dockPages: null }) }));
jest.mock('@/lib/hooks/useReturnSlug', () => ({ useReturnSlug: () => null }));
jest.mock('@/components/providers/AuthProvider', () => ({ useAuth: () => ({ activeUser: null, requireAuth: jest.fn() }) }));
jest.mock('@/components/layout/DashboardGrid', () => ({ ScreenJobs: () => null }));
jest.mock('@/components/dashboard/useDashboardLayout', () => ({ editLink: (h: string) => h }));
jest.mock('@/components/layout/WallpaperBackground', () => ({ WallpaperBackground: () => null }));
jest.mock('@/components/layout/MobileFab', () => ({ MobileFab: () => null }));
jest.mock('@/components/layout/WhatsNew', () => ({ WhatsNew: () => null }));
jest.mock('@/lib/hooks/useInactivityRedirect', () => ({ useInactivityRedirect: () => {} }));
// The household's settings: the scenery look (#808) hides navigation on a
// screen that never chose. Answered when `settingsAnswer` settles.
jest.mock('@/lib/utils/sharedGet', () => ({
  sharedGet: () => settingsAnswer.then(() => ({
    ok: true,
    json: () => Promise.resolve({ settings: householdScenery === null ? {} : { wallpaperScenery: householdScenery } }),
  })),
}));

import { AppShell } from '../AppShell';
import { DOCK_WALL_MS } from '../Dock';
import { resetSceneryOnCache } from '@/lib/hooks/useSceneryOn';

const AUTO_HIDE = 'prism:auto-hide-ui';

async function dashboard() {
  const view = render(<AppShell dock="wall" showWallpaper><div data-page>dashboard</div></AppShell>);
  // Let the household's answer land.
  await act(async () => { await settingsAnswer; await Promise.resolve(); await Promise.resolve(); });
  return view;
}

const dock = (c: HTMLElement) => c.querySelector<HTMLElement>('nav[data-dock]');
const menuTab = (c: HTMLElement) => c.querySelector('[data-dock-menu]');
const main = (c: HTMLElement) => c.querySelector('main')!;

beforeEach(() => {
  jest.useFakeTimers();
  window.localStorage.clear();
  resetSceneryOnCache();
  householdScenery = false;
  mobile = false;
  settingsAnswer = Promise.resolve();
  // The household read is skipped where there is no fetch; the request itself
  // goes through the sharedGet stand-in above.
  global.fetch = jest.fn() as unknown as typeof fetch;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('the dock on a dashboard and Auto-hide navigation (#1232)', () => {
  it('off: the dock stays on screen after ten quiet seconds, and the page keeps its room', async () => {
    window.localStorage.setItem(AUTO_HIDE, 'false');
    const { container } = await dashboard();
    fireEvent.pointerDown(window);
    act(() => { jest.advanceTimersByTime(DOCK_WALL_MS + 1000); });
    expect(dock(container)!.getAttribute('aria-hidden')).toBeNull();
    expect(dock(container)!.className).toContain('opacity-100');
    expect(menuTab(container)).toBeNull();
    expect(main(container).className).toContain('pb-(--nav-bottom)');
  });

  it('on: the dock is tucked behind the Menu tab, and nothing is kept clear for it', async () => {
    window.localStorage.setItem(AUTO_HIDE, 'true');
    const { container } = await dashboard();
    expect(menuTab(container)).not.toBeNull();
    expect(dock(container)!.getAttribute('aria-hidden')).toBe('true');
    expect(main(container).className).not.toContain('pb-(--nav-bottom)');
  });

  it('never chosen, on an install without the scenery look: the dock stays on screen', async () => {
    householdScenery = null;
    const { container } = await dashboard();
    expect(menuTab(container)).toBeNull();
    expect(dock(container)!.getAttribute('aria-hidden')).toBeNull();
  });

  it('never chosen, on an install with the scenery look: the dock is tucked', async () => {
    householdScenery = true;
    const { container } = await dashboard();
    expect(menuTab(container)).not.toBeNull();
  });

  it('never chosen: tucked until the household answers, so a hiding screen never shows the dock first', async () => {
    householdScenery = true;
    let answer!: () => void;
    settingsAnswer = new Promise<void>((r) => { answer = r; });
    const { container } = render(<AppShell dock="wall" showWallpaper><div /></AppShell>);
    expect(menuTab(container)).not.toBeNull();
    await act(async () => { answer(); await settingsAnswer; await Promise.resolve(); await Promise.resolve(); });
    expect(menuTab(container)).not.toBeNull();
  });
});

// #1355: a phone page drags and springs back natively. Nothing cancels a
// vertical drag, even on a page with nothing to scroll (this reverses #1076).
describe('a drag on a phone page (#1355)', () => {
  const drag = (target: Element, dy: number) => {
    const at = (y: number) => [{ identifier: 0, target, clientX: 100, clientY: y }];
    const ev = (type: string, y: number) => {
      const e = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(e, 'touches', { value: at(y) });
      return e;
    };
    target.dispatchEvent(ev('touchstart', 300));
    const move = ev('touchmove', 300 + dy);
    target.dispatchEvent(move);
    return move.defaultPrevented;
  };

  it('is not cancelled, down or up', async () => {
    mobile = true;
    const { container } = render(<AppShell><div data-page>page</div></AppShell>);
    await act(async () => { await Promise.resolve(); });
    const page = container.querySelector('[data-page]')!;
    expect({ down: drag(page, 40), up: drag(page, -40) }).toEqual({ down: false, up: false });
  });
});
