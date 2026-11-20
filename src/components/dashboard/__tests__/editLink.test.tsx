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
import { EDIT_HERE_KEY } from '@/lib/displays/editPlace';

let activeUser: { role: string } | null = null;
jest.mock('@/components/providers/AuthProvider', () => ({
  useAuth: () => ({ activeUser, requireAuth: jest.fn() }),
}));
const push = jest.fn();
const replace = jest.fn();
jest.mock('next/navigation', () => ({ usePathname: () => window.location.pathname, useRouter: () => ({ push, replace }) }));

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
  // These open the editor in place, as a screen does (#1265).
  localStorage.setItem(EDIT_HERE_KEY, '1');
  activeUser = null;
  push.mockReset();
  replace.mockReset();
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

describe('where Edit opens (#1265)', () => {
  const NAMED = 'prism_display_named=1';
  afterEach(() => { document.cookie = `${NAMED}; expires=Thu, 01 Jan 1970 00:00:00 GMT`; });

  it('a device that is not a named screen goes to the canvas editor in place of the link', () => {
    localStorage.removeItem(EDIT_HERE_KEY);
    activeUser = { role: 'parent' };
    window.history.replaceState(null, '', editLink('/d/kitchen'));
    const { result } = renderHook(() => useDashboardLayout(layouts, 'kitchen'));
    expect(result.current.isEditing).toBe(false);
    expect(replace).toHaveBeenCalledWith('/edit/k');
  });

  it('and its Edit button opens the canvas editor', async () => {
    localStorage.removeItem(EDIT_HERE_KEY);
    activeUser = { role: 'parent' };
    window.history.replaceState(null, '', '/d/kitchen');
    const { result } = renderHook(() => useDashboardLayout(layouts, 'kitchen'));
    await act(async () => { await result.current.handleEditStart(); });
    expect(result.current.isEditing).toBe(false);
    expect(push).toHaveBeenCalledWith('/edit/k');
  });

  it('a named screen edits on itself', async () => {
    localStorage.removeItem(EDIT_HERE_KEY);
    document.cookie = NAMED;
    activeUser = { role: 'parent' };
    window.history.replaceState(null, '', '/d/kitchen');
    const { result } = renderHook(() => useDashboardLayout(layouts, 'kitchen'));
    await act(async () => { await result.current.handleEditStart(); });
    expect(result.current.isEditing).toBe(true);
    expect(push).not.toHaveBeenCalled();
  });

  it('so does a device that chose to edit here', async () => {
    activeUser = { role: 'parent' };
    window.history.replaceState(null, '', '/d/kitchen');
    const { result } = renderHook(() => useDashboardLayout(layouts, 'kitchen'));
    await act(async () => { await result.current.handleEditStart(); });
    expect(result.current.isEditing).toBe(true);
    expect(push).not.toHaveBeenCalled();
  });
});
