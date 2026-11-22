/**
 * @jest-environment jsdom
 *
 * The dock's More panel (#1257): three groups of one tile style, This screen
 * first on a wall and last on a phone, and This screen on every page, with
 * Edit layout going to the screen's dashboard with the editor open.
 */
import { render, fireEvent, act } from '@testing-library/react';

let pathname = '/chores';
let narrow = false;
let activeUser: { role: string } | null = null;
const push = jest.fn();
const requireAuth = jest.fn();

jest.mock('next-intl', () => ({ useTranslations: () => (_k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? _k }));
jest.mock('next/navigation', () => ({ usePathname: () => pathname, useRouter: () => ({ push }) }));
jest.mock('@/lib/hooks/useIsMobile', () => ({ useIsMobile: () => narrow }));
jest.mock('@/components/screensaver/calmMode', () => ({ useCalmIdle: () => false }));
jest.mock('@/lib/hooks/useHiddenPages', () => ({ useHiddenPages: () => ({ filterNavItems: <T,>(i: T) => i, dockPages: null }) }));
jest.mock('@/lib/hooks/useReturnSlug', () => ({ useReturnSlug: () => null }));
jest.mock('@/components/providers/AuthProvider', () => ({ useAuth: () => ({ activeUser, requireAuth }) }));
// The mode toggles reach for hooks and the API; here only their markup matters.
jest.mock('@/components/away-mode', () => ({ AwayModeToggle: ({ showLabel: _s, ...p }: { showLabel?: boolean }) => <button data-screen-job="away" {...p}>Away mode</button> }));
jest.mock('@/components/babysitter-mode', () => ({ BabysitterModeToggle: ({ showLabel: _s, ...p }: { showLabel?: boolean }) => <button data-screen-job="babysitter" {...p}>Babysitter mode</button> }));
jest.mock('@/components/layout/PerformanceModeBadge', () => ({ PerformanceModeBadge: () => null }));
jest.mock('@/lib/hooks/useAutoHideUI', () => ({ useAutoHideUI: () => ({ uiHidden: false }) }));

import { Dock, screenEditHref } from '../Dock';
import { MORE_TILE } from '@/lib/constants/dock';

function openMore() {
  render(<Dock mode="page" user={null} onLogin={() => {}} />);
  fireEvent.click(document.querySelector('[data-dock-more]')!);
  return document.querySelector<HTMLElement>('[data-dock-more-panel]')!;
}
const groups = (panel: HTMLElement) => [...panel.querySelectorAll<HTMLElement>('[data-dock-more-group]')].map((g) => g.dataset.dockMoreGroup);
const job = (panel: HTMLElement, name: string) => panel.querySelector<HTMLElement>(`[data-screen-job="${name}"]`);

beforeEach(() => {
  pathname = '/chores';
  narrow = false;
  activeUser = null;
  push.mockReset();
  requireAuth.mockReset();
});

describe('the More panel (#1257)', () => {
  it('on a wall: This screen, Pages, Prism, every tile the same, no pill row', () => {
    const panel = openMore();
    expect(groups(panel)).toEqual(['screen', 'pages', 'prism']);
    expect(panel.querySelector('[data-dock-more-top]')).toBeNull();
    const prism = panel.querySelector('[data-dock-prism]')!;
    expect([...prism.querySelectorAll('[data-dock-item]')].map((e) => e.getAttribute('data-dock-item'))).toEqual(['/settings', '/help']);
    expect(prism.querySelector('[data-dock-sign]')?.textContent).toBe('Sign in');
    const tiles = [...panel.querySelectorAll<HTMLElement>('[data-dock-more-tiles] > *')];
    expect(tiles.length).toBeGreaterThan(8);
    for (const tile of tiles) for (const c of MORE_TILE.split(' ')) expect(tile.className.split(' ')).toContain(c);
  });

  it('on a phone: Pages, Prism, This screen, with no Edit layout or screensaver', () => {
    narrow = true;
    const panel = openMore();
    expect(groups(panel)).toEqual(['pages', 'prism', 'screen']);
    expect(job(panel, 'reload')).not.toBeNull();
    expect(job(panel, 'away')).not.toBeNull();
    expect(job(panel, 'edit')).toBeNull();
    expect(job(panel, 'screensaver')).toBeNull();
  });

  it('a page with no jobs of its own still has This screen, and Edit layout opens the dashboard with the editor', async () => {
    activeUser = { role: 'parent' };
    const panel = openMore();
    for (const j of ['edit', 'reload', 'babysitter', 'away', 'screensaver']) expect(job(panel, j)).not.toBeNull();
    await act(async () => { fireEvent.click(job(panel, 'edit')!); });
    expect(requireAuth).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/?edit=1');
  });

  it('inside a dashboard, Edit layout goes to that dashboard', async () => {
    activeUser = { role: 'parent' };
    pathname = '/d/kitchen/chores';
    const panel = openMore();
    await act(async () => { fireEvent.click(job(panel, 'edit')!); });
    expect(push).toHaveBeenCalledWith('/d/kitchen?edit=1');
    expect(screenEditHref('/settings', { get: (k) => (k === 'from' ? 'kitchen' : null) })).toBe('/d/kitchen?edit=1');
  });

  it('signed out, Edit layout asks for a parent first and goes nowhere for a child', async () => {
    requireAuth.mockResolvedValueOnce({ role: 'child' });
    const panel = openMore();
    await act(async () => { fireEvent.click(job(panel, 'edit')!); });
    expect(requireAuth).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('a signed-in child sees no Edit layout', () => {
    activeUser = { role: 'child' };
    const panel = openMore();
    expect(job(panel, 'edit')).toBeNull();
    expect(job(panel, 'reload')).not.toBeNull();
  });

  it('Screensaver starts it where you are', () => {
    const panel = openMore();
    const started = jest.fn();
    window.addEventListener('prism:screensaver', started);
    fireEvent.click(job(panel, 'screensaver')!);
    window.removeEventListener('prism:screensaver', started);
    expect(started).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it('a page that brings its own jobs keeps them', () => {
    render(<Dock mode="wall" user={null} screenJobs={<button data-screen-job="own">Own</button>} />);
    fireEvent.click(document.querySelector('[data-dock-menu]')!);
    fireEvent.click(document.querySelector('[data-dock-more]')!);
    const panel = document.querySelector<HTMLElement>('[data-dock-more-panel]')!;
    expect(job(panel, 'own')).not.toBeNull();
    expect(job(panel, 'reload')).toBeNull();
  });
});
