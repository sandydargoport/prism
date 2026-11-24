/**
 * @jest-environment jsdom
 *
 * The running screensaver reads its layout from browser storage, which the
 * dashboard writes when it opens. A dashboard that never saved a screensaver
 * must get the default there, not the previous dashboard's (#688).
 */

import { act, renderHook } from '@testing-library/react';
import { useDashboardLayout } from '../useDashboardLayout';
import { DEFAULT_SCREENSAVER_LAYOUT } from '@/components/screensaver/screensaverStorage';
import type { Layout, WidgetConfig } from '@/lib/hooks/useLayouts';
import { backgroundOf, parseScreenDay, serializeScreenDay } from '@/lib/screenDay';
import { DEFAULT_NIGHT } from '@/lib/throughTheDay';
import type { IdleSource } from '@/lib/idleBackground';

let activeUser: { id: string; role: string } | null = null;
jest.mock('@/components/providers/AuthProvider', () => ({
  useAuth: () => ({ activeUser, requireAuth: jest.fn() }),
}));
jest.mock('next/navigation', () => ({ usePathname: () => window.location.pathname, useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));
// Editing happens in the canvas's frame (#1283); these say when the hook is in one.
let mockInFrame = false;
const mockHost = { displayId: null, dashboardId: null, switches: [], settings: {}, settingsUpdatedAt: null };
jest.mock('@/lib/displays/remoteEdit', () => ({
  ...jest.requireActual('@/lib/displays/remoteEdit'),
  remoteEditHost: () => (mockInFrame ? mockHost : null),
}));

const KEY = 'prism-screensaver-layout';
const custom: WidgetConfig[] = [{ i: 'clock', x: 0, y: 0, w: 48, h: 48, visible: true }];

const dashboard = (id: string, screensaverWidgets: WidgetConfig[] | null) =>
  ({ id, slug: id, name: id, isDefault: id === 'a', widgets: [], screensaverWidgets }) as unknown as Layout;

const data = (all: Layout[]) => ({
  savedLayout: all[0] ?? null,
  saveLayout: jest.fn(),
  deleteLayout: jest.fn(),
  allLayouts: all,
  loading: false,
});

const stored = () => JSON.parse(localStorage.getItem(KEY) ?? 'null');
/** This screen's day (#1345): one look by day and night, how much darker. */
const DAY_KEY = 'prism-screen-day';
const screenIdles = (look: IdleSource, nightLevel: 0 | 25 | 50 | 75 = 0) =>
  localStorage.setItem(DAY_KEY, serializeScreenDay({ day: look, night: look, switch: DEFAULT_NIGHT, nightLevel }));
const screenDay = () => parseScreenDay(localStorage.getItem(DAY_KEY));

beforeEach(() => { localStorage.clear(); activeUser = null; mockInFrame = false; });

describe('screensaver per dashboard', () => {
  it('gives a dashboard with no saved screensaver the default, not the last one shown', () => {
    const layouts = data([dashboard('a', custom), dashboard('b', null)]);
    const { result, rerender } = renderHook(({ slug }) => useDashboardLayout(layouts, slug), {
      initialProps: { slug: 'a' },
    });
    expect(stored()).toEqual(custom);

    rerender({ slug: 'b' });
    expect(stored()).toEqual(DEFAULT_SCREENSAVER_LAYOUT);
    expect(result.current.ssLayout).toEqual(DEFAULT_SCREENSAVER_LAYOUT);
  });

  it('starts a dashboard with none on the default even when opened directly', () => {
    localStorage.setItem(KEY, JSON.stringify(custom));
    // A browser that has run since the upgrade from v1.30.1 (#1154).
    localStorage.setItem('prism-screensaver-carried', '1');
    const layouts = data([dashboard('a', custom), dashboard('b', null)]);
    const { result } = renderHook(() => useDashboardLayout(layouts, 'b'));
    expect(result.current.ssLayout).toEqual(DEFAULT_SCREENSAVER_LAYOUT);
    expect(stored()).toEqual(DEFAULT_SCREENSAVER_LAYOUT);
  });

  it('carries over a screensaver from before dashboards had their own', () => {
    localStorage.setItem(KEY, JSON.stringify(custom));
    const layouts = data([dashboard('a', null), dashboard('b', null)]);
    const { result } = renderHook(() => useDashboardLayout(layouts, 'a'));
    expect(result.current.ssLayout.find((w) => w.i === 'clock')).toMatchObject(custom[0]!);
    expect(stored().find((w: WidgetConfig) => w.i === 'clock')).toMatchObject(custom[0]!);
  });
});

describe('the upgrade from v1.30.1 (#1154)', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    // 0039 set every dashboard to photos, and 0057 gave each screen that day.
    screenIdles('photos');
  });

  it('shows a dashboard with none of its own the arrangement this browser kept, and carries it there once', async () => {
    localStorage.setItem(KEY, JSON.stringify(custom));
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    const layouts = data([dashboard('a', [{ i: 'weather', x: 0, y: 0, w: 8, h: 8, visible: true }]), dashboard('b', null)]);
    const { result } = renderHook(() => useDashboardLayout(layouts, 'b'));
    expect(result.current.ssLayout.find((w) => w.i === 'clock')).toMatchObject(custom[0]!);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/layouts/b');
    expect(JSON.parse(init.body)).toMatchObject({ carryOver: true });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(localStorage.getItem('prism-screensaver-carried')).toBe('1');
  });

  it('keeps showing it, and tries again next time, when the carry is refused', async () => {
    localStorage.setItem(KEY, JSON.stringify(custom));
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    const layouts = data([dashboard('a', [{ i: 'weather', x: 0, y: 0, w: 8, h: 8, visible: true }]), dashboard('b', null)]);
    const { result } = renderHook(() => useDashboardLayout(layouts, 'b'));
    expect(result.current.ssLayout.find((w) => w.i === 'clock')).toMatchObject(custom[0]!);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(localStorage.getItem('prism-screensaver-carried')).toBeNull();
  });

  it('carries nothing to a screen that idles as its dashboard', () => {
    localStorage.setItem(KEY, JSON.stringify(custom));
    screenIdles('dashboard');
    renderHook(() => useDashboardLayout(data([dashboard('a', custom), dashboard('b', null)]), 'b'));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('prism-screensaver-carried')).toBe('1');
  });
});

describe('one editor, two tabs, one Save (#782)', () => {
  // The dashboard is edited in the canvas's frame (#1283).
  beforeEach(() => { mockInFrame = true; });
  const edited: WidgetConfig[] = [{ i: 'tasks', x: 0, y: 0, w: 12, h: 12, visible: true }];
  const idleEdited: WidgetConfig[] = [{ i: 'weather', x: 4, y: 4, w: 16, h: 16, visible: true }];

  async function editing(layout: Layout = dashboard('a', custom)) {
    activeUser = { id: 'p1', role: 'parent' };
    const layouts = data([layout]);
    const hook = renderHook(() => useDashboardLayout(layouts, 'a'));
    await act(async () => { await hook.result.current.handleEditStart(); });
    return { layouts, result: hook.result };
  }
  // The screen idles over photos; the dashboard's own old look is not read.
  const photos = () => { screenIdles('photos', 50); return { ...dashboard('a', custom), idleBackground: { source: 'sky' } } as Layout; };

  it('keeps unsaved edits in both tabs when switching between them, and Save stores both', async () => {
    const { layouts, result } = await editing(photos());
    act(() => { result.current.setEditingWidgets(edited); });
    act(() => { result.current.setEditTab('idle'); });
    expect(result.current.editingScreensaver).toBe(true);
    act(() => { result.current.handleSsLayoutChange(idleEdited); });
    act(() => { result.current.setEditingBackground({ source: 'sky' }); });
    act(() => { result.current.setEditTab('dashboard'); });
    expect(result.current.editingWidgets).toEqual(edited);
    act(() => { result.current.setEditTab('idle'); });
    expect(result.current.ssLayout).toEqual(idleEdited);

    await act(async () => { await result.current.handleSave(); });
    expect(layouts.saveLayout).toHaveBeenCalledTimes(1);
    expect(layouts.saveLayout).toHaveBeenCalledWith(expect.objectContaining({
      id: 'a', widgets: edited, screensaverWidgets: idleEdited,
    }));
    // The idle look is the screen's (#1345): saved to its day, how much darker
    // kept, and never to the dashboard.
    expect(layouts.saveLayout.mock.calls[0]![0]).not.toHaveProperty('idleBackground');
    expect(screenDay()).toEqual({ day: 'sky', night: 'sky', switch: DEFAULT_NIGHT, nightLevel: 50 });
    expect(result.current.isEditing).toBe(false);
    // The running screensaver gets the new layout once saved.
    expect(stored()).toEqual(idleEdited);
  });

  it('saves nothing until Save, and Cancel undoes both tabs', async () => {
    const { layouts, result } = await editing(photos());
    act(() => { result.current.setEditingWidgets(edited); });
    act(() => { result.current.setEditTab('idle'); });
    act(() => { result.current.handleSsLayoutChange(idleEdited); });
    act(() => { result.current.setEditingBackground({ source: 'dashboard' }); });
    expect(stored()).toEqual(custom);

    act(() => { result.current.handleCancel(); });
    expect(layouts.saveLayout).not.toHaveBeenCalled();
    expect(backgroundOf(screenDay()!)).toEqual({ source: 'photos' });
    expect(result.current.isEditing).toBe(false);
    expect(result.current.editTab).toBe('dashboard');
    expect(result.current.activeWidgets).toEqual([]);
    expect(result.current.ssLayout).toEqual(custom);
    expect(result.current.editingBackground).toEqual({ source: 'photos' });
    expect(stored()).toEqual(custom);
  });

  it('marks only the tab whose part changed', async () => {
    const { result } = await editing({ ...photos(), widgets: [{ i: 'clock', x: 0, y: 0, w: 8, h: 8 }] } as Layout);
    expect([result.current.dashboardDirty, result.current.idleDirty]).toEqual([false, false]);

    // Stays / Fades is the idle screen's.
    act(() => { result.current.setEditingWidgets([{ i: 'clock', x: 0, y: 0, w: 8, h: 8, showWhenIdle: false }]); });
    expect([result.current.dashboardDirty, result.current.idleDirty]).toEqual([false, true]);

    act(() => { result.current.setEditingWidgets([{ i: 'clock', x: 4, y: 0, w: 8, h: 8 }]); });
    expect([result.current.dashboardDirty, result.current.idleDirty]).toEqual([true, false]);

    act(() => { result.current.setEditingWidgets([{ i: 'clock', x: 0, y: 0, w: 8, h: 8 }]); });
    act(() => { result.current.setEditingBackground({ source: 'sky' }); });
    expect([result.current.dashboardDirty, result.current.idleDirty]).toEqual([false, true]);
  });

  it('takes the screen\'s day when it arrives after editing starts', async () => {
    activeUser = { id: 'p1', role: 'parent' };
    const layouts = data([dashboard('a', custom)]);
    const { result } = renderHook(() => useDashboardLayout(layouts, 'a'));
    await act(async () => { await result.current.handleEditStart(); });
    act(() => { screenIdles('sky'); window.dispatchEvent(new StorageEvent('storage', { key: DAY_KEY })); });
    expect(result.current.editingBackground).toEqual({ source: 'sky' });
    expect(result.current.idleDirty).toBe(false);
  });

  it('edits the screen\'s day, not the day of the dashboard open (#1345)', async () => {
    screenIdles('photos');
    const { result } = await editing({ ...dashboard('a', custom), idleBackground: { source: 'sky' } } as Layout);
    expect(result.current.editingBackground).toEqual({ source: 'photos' });
  });

  it('arranges the previewed half of a day and night pair', async () => {
    screenIdles('dashboard');
    const { result } = await editing(dashboard('a', custom));
    act(() => { result.current.setEditTab('idle'); });
    act(() => {
      result.current.setEditingBackground({ day: 'dashboard', night: 'sky', switch: { by: 'sun', duskOffset: 0, dawnOffset: 0 } });
    });
    expect(result.current.idleHalf).toBe('day');
    expect(result.current.editingScreensaver).toBe(false);
    act(() => { result.current.setIdleHalf('night'); });
    expect(result.current.editingScreensaver).toBe(true);
  });

  it('arranges a screensaver layout on the Idle screen tab only behind photos or the sky', async () => {
    screenIdles('dashboard');
    const { result } = await editing(dashboard('a', custom));
    act(() => { result.current.setEditTab('idle'); });
    expect(result.current.editingScreensaver).toBe(false);
    act(() => { result.current.setEditingBackground({ source: 'photos' }); });
    expect(result.current.editingScreensaver).toBe(true);
    act(() => { result.current.setEditTab('dashboard'); });
    expect(result.current.editingScreensaver).toBe(false);
  });
});
