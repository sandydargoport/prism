/**
 * @jest-environment jsdom
 *
 * Switching dashboards from the layout editor opens the next one with ?edit=1,
 * and it must open in edit mode: for a parent only, and only once, so a reload
 * afterwards opens the dashboard normally.
 */

import { renderHook, act } from '@testing-library/react';
import { useDashboardLayout, editLink } from '../useDashboardLayout';
import type { Layout, WidgetConfig } from '@/lib/hooks/useLayouts';

let activeUser: { role: string } | null = null;
jest.mock('@/components/providers/AuthProvider', () => ({
  useAuth: () => ({ activeUser, requireAuth: jest.fn() }),
}));
jest.mock('next/navigation', () => ({ usePathname: () => window.location.pathname }));

const widgets: WidgetConfig[] = [{ i: 'clock', x: 0, y: 0, w: 4, h: 4, visible: true }];
const kitchen = { id: 'k', slug: 'kitchen', name: 'Kitchen', isDefault: false, widgets, screensaverWidgets: null } as unknown as Layout;
const layouts = {
  savedLayout: null,
  saveLayout: jest.fn(),
  deleteLayout: jest.fn(),
  allLayouts: [kitchen],
  loading: false,
};

beforeEach(() => {
  localStorage.clear();
  activeUser = null;
});

describe('opening a dashboard in edit mode from a link', () => {
  it('builds the link', () => {
    expect(editLink('/d/kitchen')).toBe('/d/kitchen?edit=1');
  });

  it('opens a parent straight into edit mode, then drops ?edit from the address', () => {
    activeUser = { role: 'parent' };
    window.history.replaceState(null, '', editLink('/d/kitchen'));
    const { result } = renderHook(() => useDashboardLayout(layouts, 'kitchen'));
    expect(result.current.isEditing).toBe(true);
    expect(result.current.editingWidgets).toEqual(widgets);
    expect(window.location.search).toBe('');
  });

  it('does not open edit mode for anyone but a parent', () => {
    activeUser = { role: 'child' };
    window.history.replaceState(null, '', editLink('/d/kitchen'));
    const { result } = renderHook(() => useDashboardLayout(layouts, 'kitchen'));
    expect(result.current.isEditing).toBe(false);
  });

  it('opens normally without the parameter', () => {
    activeUser = { role: 'parent' };
    window.history.replaceState(null, '', '/d/kitchen');
    const { result } = renderHook(() => useDashboardLayout(layouts, 'kitchen'));
    expect(result.current.isEditing).toBe(false);
  });

  it('Cancel after opening this way puts back the layout from before editing', () => {
    activeUser = { role: 'parent' };
    window.history.replaceState(null, '', editLink('/d/kitchen'));
    const { result } = renderHook(() => useDashboardLayout(layouts, 'kitchen'));
    act(() => result.current.setEditingWidgets([]));
    act(() => result.current.handleCancel());
    expect(result.current.isEditing).toBe(false);
    expect(result.current.editingWidgets).toEqual(widgets);
  });
});
