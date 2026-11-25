/**
 * @jest-environment jsdom
 *
 * The dock's More panel (#1257): groups of one tile style. On a wall This
 * screen leads, on every page, with Edit layout going to the screen's
 * dashboard with the editor open. A phone has Pages, This phone, Screens and
 * Prism (#1354).
 */
import { render, fireEvent, act, waitFor, screen, cleanup } from '@testing-library/react';

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
jest.mock('@/components/layout/PerformanceModeBadge', () => ({ PerformanceModeBadge: ({ className }: { className?: string }) => <button data-performance-badge className={className}>Performance</button> }));
jest.mock('@/lib/hooks/useAutoHideUI', () => ({ useAutoHideUI: () => ({ uiHidden: false }) }));

import { Dock, screenEditHref } from '../Dock';
import { MORE_TILE } from '@/lib/constants/dock';
import { REFERENDUM } from '@/lib/feedback/referendum';

// /api/feedback for the Feedback card (#1311). By default it does not answer,
// so the card stays hidden in the tests above that are about the tiles.
const fetchMock = jest.fn();

function openMore(cardTools = false) {
  render(<Dock mode="page" user={null} onLogin={() => {}} cardTools={cardTools} />);
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
  fetchMock.mockReset().mockRejectedValue(new Error('no server in this test'));
  global.fetch = fetchMock as unknown as typeof fetch;
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

  it('on a wall, This screen keeps the performance badge', () => {
    const panel = openMore();
    expect(panel.querySelector('[data-dock-more-group="screen"] [data-performance-badge]')).not.toBeNull();
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
    // Only a parent can go on, so the sign-in list offers parents alone (#1330).
    expect(requireAuth).toHaveBeenCalledWith('Sign in to edit', expect.any(String), { parentsOnly: true });
    expect(push).not.toHaveBeenCalled();
  });

  it('a signed-in child sees no Edit layout', () => {
    activeUser = { role: 'child' };
    const panel = openMore();
    expect(job(panel, 'edit')).toBeNull();
    expect(job(panel, 'reload')).not.toBeNull();
  });

  it('Idle now starts idle where you are', () => {
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

describe("a phone's More (#1354)", () => {
  const items = (panel: HTMLElement, group: string) =>
    [...panel.querySelectorAll<HTMLElement>(`[data-dock-more-group="${group}"] [data-dock-more-tiles] > *`)].map((e) => e.textContent);
  const phoneJob = (name: string) => document.querySelector<HTMLElement>(`[data-dock-more-panel] [data-phone-job="${name}"]`);

  beforeEach(() => { narrow = true; activeUser = { role: 'parent' }; });

  it('on a dashboard of cards: Pages, This phone (Cards, Reorder, Reload), Screens (Edit a screen, Away, Babysitter), Prism', () => {
    const panel = openMore(true);
    expect(groups(panel)).toEqual(['pages', 'phone', 'screens', 'prism']);
    expect(panel.querySelector('[data-dock-more-group="phone"] p')?.textContent).toBe('This phone');
    expect(items(panel, 'phone')).toEqual(['Cards', 'Reorder', 'Reload']);
    expect(items(panel, 'screens')).toEqual(['Edit a screen', 'Away mode', 'Babysitter mode']);
    expect(items(panel, 'prism')[0]).toBe('Settings');
    expect(items(panel, 'prism')).toContain('Help');
    expect(items(panel, 'prism').at(-1)).toBe('Sign in');
    for (const tile of panel.querySelectorAll<HTMLElement>('[data-dock-more-tiles] > *')) for (const c of MORE_TILE.split(' ')) expect(tile.className.split(' ')).toContain(c);
  });

  it('elsewhere This phone has Reload alone, and there is no This screen, Edit layout, screensaver or performance badge', () => {
    const panel = openMore();
    expect(groups(panel)).toEqual(['pages', 'phone', 'screens', 'prism']);
    expect(items(panel, 'phone')).toEqual(['Reload']);
    for (const j of ['edit', 'screensaver', 'reload']) expect(job(panel, j)).toBeNull();
    expect(panel.querySelector('[data-performance-badge]')).toBeNull();
  });

  it('a signed-in child keeps Away and Babysitter under Screens, with no Edit a screen', () => {
    activeUser = { role: 'child' };
    const panel = openMore(true);
    expect(items(panel, 'screens')).toEqual(['Away mode', 'Babysitter mode']);
  });

  it.each([['Cards', 'cards', 'prism:phone-cards'], ['Reorder', 'reorder', 'prism:mobile-reorder']])('%s starts only once More has closed', async (_n, name, event) => {
    openMore(true);
    let moreWasOpen: boolean | null = null;
    let detail: unknown = null;
    const heard = jest.fn((e: Event) => {
      moreWasOpen = document.querySelector('[data-dock-more-panel]') !== null;
      detail = (e as CustomEvent).detail;
    });
    window.addEventListener(event, heard);
    try {
      act(() => { fireEvent.click(phoneJob(name)!); });
      await waitFor(() => expect(heard).toHaveBeenCalledTimes(1));
      expect(moreWasOpen).toBe(false);
      expect(detail).toEqual({ active: true });
    } finally {
      window.removeEventListener(event, heard);
    }
  });
});

describe('a phone edits a screen from More (#1353)', () => {
  /** /api/displays and /api/layouts answer with these. */
  const serve = (screens: Array<{ id: string }>, layouts: Array<{ id: string; isDefault: boolean }> = []) => {
    fetchMock.mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => (url === '/api/displays' ? { displays: screens } : url === '/api/layouts' ? { layouts } : {}),
    }));
  };
  const tile = (panel: HTMLElement) => panel.querySelector<HTMLElement>('[data-dock-more-group="screens"] [data-screen-job="edit-a-screen"]');
  const press = async () => {
    const panel = openMore();
    expect(tile(panel)?.textContent).toBe('Edit a screen');
    await act(async () => { fireEvent.click(tile(panel)!); });
  };

  beforeEach(() => { narrow = true; });

  it('one named screen opens its editor', async () => {
    activeUser = { role: 'parent' };
    serve([{ id: 'hall' }]);
    await press();
    expect(push).toHaveBeenCalledWith('/screens/hall');
  });

  it('two or more open Settings > Screens', async () => {
    activeUser = { role: 'parent' };
    serve([{ id: 'hall' }, { id: 'kitchen' }]);
    await press();
    expect(push).toHaveBeenCalledWith('/settings?section=displays');
  });

  it("none opens the default dashboard's editor", async () => {
    activeUser = { role: 'parent' };
    serve([], [{ id: 'other', isDefault: false }, { id: 'main', isDefault: true }]);
    await press();
    expect(push).toHaveBeenCalledWith('/edit/main');
  });

  it("signed out, it asks for a parent's PIN first, and a child goes nowhere", async () => {
    serve([{ id: 'hall' }]);
    requireAuth.mockResolvedValueOnce({ role: 'child' });
    await press();
    expect(requireAuth).toHaveBeenCalledWith('Sign in to edit', expect.any(String), { parentsOnly: true });
    expect(push).not.toHaveBeenCalled();
    requireAuth.mockResolvedValueOnce({ role: 'parent' });
    await act(async () => { fireEvent.click(document.querySelector('[data-dock-more]')!); });
    await act(async () => { fireEvent.click(tile(document.querySelector<HTMLElement>('[data-dock-more-panel]')!)!); });
    expect(push).toHaveBeenCalledWith('/screens/hall');
  });

  it('a signed-in child has no Edit a screen, and a wall has no Screens group', () => {
    activeUser = { role: 'child' };
    let panel = openMore();
    expect(tile(panel)).toBeNull();
    cleanup();
    activeUser = { role: 'parent' };
    narrow = false;
    panel = openMore();
    expect(groups(panel)).not.toContain('screens');
  });
});

describe('Feedback beside Help in More (#1311)', () => {
  const state = (over: Record<string, unknown> = {}) => ({
    referendum: '2026-11-navigation', open: true, answer: null, canSend: true, offReason: null, ha: false, ...over,
  });
  /** Answer GET with `get`, and POST with `post` (the route's reply to a vote). */
  const serve = (get: Record<string, unknown>, post?: { ok: boolean; body: Record<string, unknown> }) => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? { ok: post?.ok ?? true, json: async () => post?.body ?? {} }
        : { ok: true, json: async () => get });
  };
  /** More, then Feedback: the question opens in a window of its own. */
  const openFeedback = async () => {
    const panel = openMore();
    const button = panel.querySelector<HTMLElement>('[data-dock-feedback]');
    expect(button).not.toBeNull();
    fireEvent.click(button!);
    await waitFor(() => expect(document.querySelector('[data-feedback-dialog] [data-feedback-card]')).not.toBeNull());
    const dialog = document.querySelector<HTMLElement>('[data-feedback-dialog]')!;
    return { panel, dialog, card: dialog.querySelector<HTMLElement>('[data-feedback-card]')! };
  };
  const answers = (card: HTMLElement) => [...card.querySelectorAll<HTMLElement>('[data-feedback-answer]')];
  const pressed = (card: HTMLElement) => answers(card).filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent);
  const posts = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');

  it.each([['a wall', false], ['a phone', true]])('on %s: Feedback sits right after Help, More itself asks nothing, and a tap opens the question', async (_name, isNarrow) => {
    narrow = isNarrow;
    serve(state());
    const more = openMore();
    const help = more.querySelector('[data-dock-item="/help"]')!;
    expect(help.nextElementSibling?.hasAttribute('data-dock-feedback')).toBe(true);
    expect(more.querySelector('[data-dock-feedback]')!.textContent).toBe('Feedback');
    expect(more.querySelector('[data-feedback-card]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    const { dialog, card } = await openFeedback();
    expect(dialog.textContent).toContain('Feedback');
    expect(card.textContent).toContain('Where do you like the page buttons: in the bar along the bottom, or in a sidebar?');
    expect(answers(card).map((b) => b.textContent)).toEqual(['The bar along the bottom', 'A sidebar']);
    expect(pressed(card)).toEqual([]);
    expect(card.querySelector('[data-feedback-thanks]')).toBeNull();
  });

  it('a tap sends the vote and says thanks, with that answer marked; another tap changes it', async () => {
    serve(state(), { ok: true, body: state({ answer: 'sidebar' }) });
    const { card } = await openFeedback();
    await act(async () => { fireEvent.click(card.querySelector('[data-feedback-answer="sidebar"]')!); });

    expect(posts()).toHaveLength(1);
    const [url, init] = posts()[0]!;
    expect(url).toBe('/api/feedback');
    expect(JSON.parse(init.body)).toEqual({ referendumId: '2026-11-navigation', answer: 'sidebar' });
    expect(card.querySelector('[data-feedback-thanks]')?.textContent).toContain('Thanks, your vote is counted.');
    expect(pressed(card)).toEqual(['A sidebar']);

    serve(state({ answer: 'sidebar' }), { ok: true, body: state({ answer: 'bottom-bar' }) });
    await act(async () => { fireEvent.click(card.querySelector('[data-feedback-answer="bottom-bar"]')!); });
    expect(JSON.parse(posts().at(-1)![1].body).answer).toBe('bottom-bar');
    expect(pressed(card)).toEqual(['The bar along the bottom']);
  });

  it("on reopen, the install's answer is marked", async () => {
    serve(state({ answer: 'bottom-bar' }));
    const { card } = await openFeedback();
    expect(pressed(card)).toEqual(['The bar along the bottom']);
    expect(card.querySelector('[data-feedback-thanks]')).not.toBeNull();
    expect(posts()).toHaveLength(0);
  });

  it("with anonymous stats off: says the vote can't be sent, offers no buttons, and sends nothing", async () => {
    serve(state({ canSend: false, offReason: 'disabled' }));
    const { card } = await openFeedback();
    expect(card.querySelector('[data-feedback-off]')?.textContent).toContain("Anonymous stats are off on this install, so this vote can't be sent.");
    expect(answers(card)).toEqual([]);
    expect(card.querySelector('[data-feedback-poll]')).toBeNull(); // no poll yet
    expect(posts()).toHaveLength(0);
  });

  it('on Home Assistant it says where the switch is, and links the poll once there is one', async () => {
    serve(state({ canSend: false, offReason: 'hard-disabled', ha: true }));
    REFERENDUM.pollUrl = 'https://example.com/prism-poll';
    try {
      const { card } = await openFeedback();
      const off = card.querySelector('[data-feedback-off]')!;
      expect(off.textContent).toContain("the add-on's Configuration tab, Anonymous stats");
      expect(off.querySelector('a[data-feedback-poll]')?.getAttribute('href')).toBe('https://example.com/prism-poll');
    } finally {
      REFERENDUM.pollUrl = '';
    }
  });

  it('a vote the counter did not take says so and marks nothing', async () => {
    serve(state(), { ok: false, body: { error: "The vote couldn't be sent. Try again in a moment." } });
    const { card } = await openFeedback();
    await act(async () => { fireEvent.click(card.querySelector('[data-feedback-answer="sidebar"]')!); });
    expect(card.querySelector('[role="alert"]')?.textContent).toBe("The vote couldn't be sent. Try again in a moment.");
    expect(pressed(card)).toEqual([]);
    expect(card.querySelector('[data-feedback-thanks]')).toBeNull();
  });

  it('has no Feedback button once the question has closed', async () => {
    REFERENDUM.openUntil = '2000-01-01';
    try {
      const panel = openMore();
      await act(async () => {});
      expect(panel.querySelector('[data-dock-feedback]')).toBeNull();
      expect(document.querySelector('[data-feedback-card]')).toBeNull();
    } finally {
      delete REFERENDUM.openUntil;
    }
  });
});
