/**
 * @jest-environment jsdom
 *
 * Switching dashboards from the layout editor opens the next one with ?edit=1.
 * Every device edits on a canvas (#1265, #1280), so the link and Edit go
 * there; the dashboard is edited in place only inside the canvas's frame, for
 * a parent only. Nothing else opens the editor in place any more (#1283).
 */

import { renderHook, act } from '@testing-library/react';
import { useDashboardLayout, editLink } from '../useDashboardLayout';
import type { Layout, WidgetConfig } from '@/lib/hooks/useLayouts';

let activeUser: { role: string } | null = null;
jest.mock('@/components/providers/AuthProvider', () => ({
  useAuth: () => ({ activeUser, requireAuth: jest.fn() }),
}));
const push = jest.fn();
const replace = jest.fn();
jest.mock('next/navigation', () => ({ usePathname: () => window.location.pathname, useRouter: () => ({ push, replace }) }));
// Whether the hook runs in the canvas's frame, where the dashboard is edited.
let mockInFrame = false;
const mockHost = { displayId: null, dashboardId: null, switches: [], settings: {}, settingsUpdatedAt: null };
jest.mock('@/lib/displays/remoteEdit', () => ({
  ...jest.requireActual('@/lib/displays/remoteEdit'),
  remoteEditHost: () => (mockInFrame ? mockHost : null),
}));

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
  mockInFrame = false;
  activeUser = null;
  push.mockReset();
  replace.mockReset();
});

describe('editing in the canvas\'s frame (#1283)', () => {
  it('builds the link', () => {
    expect(editLink('/d/kitchen')).toBe('/d/kitchen?edit=1');
  });

  it('in the frame a parent edits the dashboard straight away', () => {
    mockInFrame = true;
    activeUser = { role: 'parent' };
    window.history.replaceState(null, '', '/d/kitchen');
    const { result } = renderHook(() => useDashboardLayout(layouts, 'kitchen'));
    expect(result.current.isEditing).toBe(true);
    expect(result.current.editingWidgets).toEqual(widgets);
    expect(replace).not.toHaveBeenCalled();
  });

  it('but nobody else does', () => {
    mockInFrame = true;
    activeUser = { role: 'child' };
    window.history.replaceState(null, '', '/d/kitchen');
    const { result } = renderHook(() => useDashboardLayout(layouts, 'kitchen'));
    expect(result.current.isEditing).toBe(false);
  });

  it('outside it, a dashboard opens normally without the link', () => {
    activeUser = { role: 'parent' };
    window.history.replaceState(null, '', '/d/kitchen');
    const { result } = renderHook(() => useDashboardLayout(layouts, 'kitchen'));
    expect(result.current.isEditing).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });

  it('Cancel in the frame puts back the layout from before editing', () => {
    mockInFrame = true;
    activeUser = { role: 'parent' };
    window.history.replaceState(null, '', '/d/kitchen');
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
    activeUser = { role: 'parent' };
    window.history.replaceState(null, '', editLink('/d/kitchen'));
    const { result } = renderHook(() => useDashboardLayout(layouts, 'kitchen'));
    expect(result.current.isEditing).toBe(false);
    expect(replace).toHaveBeenCalledWith('/edit/k');
  });

  it('and its Edit button opens the canvas editor', async () => {
    activeUser = { role: 'parent' };
    window.history.replaceState(null, '', '/d/kitchen');
    const { result } = renderHook(() => useDashboardLayout(layouts, 'kitchen'));
    await act(async () => { await result.current.handleEditStart(); });
    expect(result.current.isEditing).toBe(false);
    expect(push).toHaveBeenCalledWith('/edit/k');
  });

  it('a named screen opens its own editor, on the dashboard it is showing (#1280)', async () => {
    document.cookie = NAMED;
    localStorage.setItem('prism:display-sync-base', JSON.stringify({ displayId: 'hall', settings: {}, settingsUpdatedAt: null }));
    activeUser = { role: 'parent' };
    window.history.replaceState(null, '', '/d/kitchen');
    const { result } = renderHook(() => useDashboardLayout(layouts, 'kitchen'));
    await act(async () => { await result.current.handleEditStart(); });
    expect(result.current.isEditing).toBe(false);
    expect(push).toHaveBeenCalledWith('/screens/hall?dashboard=k');
  });

  it('and so does its edit link', () => {
    document.cookie = NAMED;
    localStorage.setItem('prism:display-sync-base', JSON.stringify({ displayId: 'hall', settings: {}, settingsUpdatedAt: null }));
    activeUser = { role: 'parent' };
    window.history.replaceState(null, '', editLink('/d/kitchen'));
    const { result } = renderHook(() => useDashboardLayout(layouts, 'kitchen'));
    expect(result.current.isEditing).toBe(false);
    expect(replace).toHaveBeenCalledWith('/screens/hall?dashboard=k');
  });

  it('a named screen as narrow as a phone shows cards, not a grid, so it edits the dashboard as a phone does', async () => {
    document.cookie = NAMED;
    localStorage.setItem('prism:display-sync-base', JSON.stringify({ displayId: 'pocket', settings: {}, settingsUpdatedAt: null }));
    const wide = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 393 });
    try {
      activeUser = { role: 'parent' };
      window.history.replaceState(null, '', '/d/kitchen');
      const { result } = renderHook(() => useDashboardLayout(layouts, 'kitchen'));
      await act(async () => { await result.current.handleEditStart(); });
      expect(push).toHaveBeenCalledWith('/edit/k');
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: wide });
    }
  });

  it('a device that once chose "Here, full size" gets the canvas too', async () => {
    localStorage.setItem('prism:edit-here', '1');
    activeUser = { role: 'parent' };
    window.history.replaceState(null, '', '/d/kitchen');
    const { result } = renderHook(() => useDashboardLayout(layouts, 'kitchen'));
    await act(async () => { await result.current.handleEditStart(); });
    expect(result.current.isEditing).toBe(false);
    expect(push).toHaveBeenCalledWith('/edit/k');
  });

  it('nothing opens the editor in place outside the frame, not even the key the old specs set (#1283)', async () => {
    localStorage.setItem('prism:test-edit-in-place', '1');
    activeUser = { role: 'parent' };
    window.history.replaceState(null, '', editLink('/d/kitchen'));
    const { result } = renderHook(() => useDashboardLayout(layouts, 'kitchen'));
    expect(replace).toHaveBeenCalledWith('/edit/k');
    await act(async () => { await result.current.handleEditStart(); });
    expect(result.current.isEditing).toBe(false);
    expect(push).toHaveBeenCalledWith('/edit/k');
  });
});
