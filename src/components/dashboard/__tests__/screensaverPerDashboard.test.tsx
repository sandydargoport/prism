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

describe('saving from the screensaver editor', () => {
  it("keeps the dashboard edits made before switching to the screensaver", async () => {
    activeUser = { id: 'p1', role: 'parent' };
    const layouts = data([dashboard('a', custom)]);
    const { result } = renderHook(() => useDashboardLayout(layouts, 'a'));
    await act(async () => { await result.current.handleEditStart(); });

    // Edit the dashboard, then switch to the screensaver and save from there.
    const edited: WidgetConfig[] = [{ i: 'tasks', x: 0, y: 0, w: 12, h: 12, visible: true }];
    act(() => { result.current.setEditingWidgets(edited); });
    act(() => { result.current.setEditingScreensaver(true); });
    await act(async () => { await result.current.handleSsSave(); });

    expect(layouts.saveLayout).toHaveBeenCalledWith(expect.objectContaining({ id: 'a', widgets: edited }));
  });
});
