/**
 * @jest-environment jsdom
 *
 * The running screensaver reads its layout from browser storage, which the
 * dashboard writes when it opens. A dashboard that never saved a screensaver
 * must get the default there, not the previous dashboard's (#688).
 */

import { renderHook } from '@testing-library/react';
import { useDashboardLayout } from '../useDashboardLayout';
import { DEFAULT_SCREENSAVER_LAYOUT } from '@/components/screensaver/screensaverStorage';
import type { Layout, WidgetConfig } from '@/lib/hooks/useLayouts';

jest.mock('@/components/providers/AuthProvider', () => ({
  useAuth: () => ({ activeUser: null, requireAuth: jest.fn() }),
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

beforeEach(() => localStorage.clear());

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
