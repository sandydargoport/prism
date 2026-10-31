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

let activeUser: { id: string; role: string } | null = null;
jest.mock('@/components/providers/AuthProvider', () => ({
  useAuth: () => ({ activeUser, requireAuth: jest.fn() }),
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

beforeEach(() => { localStorage.clear(); activeUser = null; });

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

describe('one editor, two tabs, one Save (#782)', () => {
  const edited: WidgetConfig[] = [{ i: 'tasks', x: 0, y: 0, w: 12, h: 12, visible: true }];
  const idleEdited: WidgetConfig[] = [{ i: 'weather', x: 4, y: 4, w: 16, h: 16, visible: true }];

  async function editing(layout: Layout = dashboard('a', custom)) {
    activeUser = { id: 'p1', role: 'parent' };
    const layouts = data([layout]);
    const hook = renderHook(() => useDashboardLayout(layouts, 'a'));
    await act(async () => { await hook.result.current.handleEditStart(); });
    return { layouts, result: hook.result };
  }
  const photos = () => ({ ...dashboard('a', custom), idleBackground: { source: 'photos' } }) as Layout;

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
      id: 'a', widgets: edited, screensaverWidgets: idleEdited, idleBackground: { source: 'sky' },
    }));
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

  it('takes the background of a dashboard that finishes loading after editing starts', async () => {
    activeUser = { id: 'p1', role: 'parent' };
    const empty = data([]);
    const loaded = data([{ ...dashboard('a', custom), idleBackground: { source: 'dashboard' } } as Layout]);
    const { result, rerender } = renderHook(({ layouts }) => useDashboardLayout(layouts, 'a'), {
      initialProps: { layouts: empty },
    });
    await act(async () => { await result.current.handleEditStart(); });
    rerender({ layouts: loaded });
    expect(result.current.editingBackground).toEqual({ source: 'dashboard' });
    expect(result.current.idleDirty).toBe(false);
  });

  it('arranges the previewed half of a day and night pair', async () => {
    const { result } = await editing({ ...dashboard('a', custom), idleBackground: { source: 'dashboard' } } as Layout);
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
    const { result } = await editing({ ...dashboard('a', custom), idleBackground: { source: 'dashboard' } } as Layout);
    act(() => { result.current.setEditTab('idle'); });
    expect(result.current.editingScreensaver).toBe(false);
    act(() => { result.current.setEditingBackground({ source: 'photos' }); });
    expect(result.current.editingScreensaver).toBe(true);
    act(() => { result.current.setEditTab('dashboard'); });
    expect(result.current.editingScreensaver).toBe(false);
  });
});
