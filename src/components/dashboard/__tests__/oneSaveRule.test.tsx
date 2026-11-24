/**
 * @jest-environment jsdom
 *
 * One save rule (#1341): the screen shape and Make the default wait for Done
 * like everything else in the editor. Nothing reaches the server before Done,
 * and Cancel sends nothing at all.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { useDashboardLayout } from '../useDashboardLayout';
import type { Layout } from '@/lib/hooks/useLayouts';

jest.mock('@/components/providers/AuthProvider', () => ({
  useAuth: () => ({ activeUser: { id: 'p', role: 'parent' }, requireAuth: jest.fn() }),
}));
jest.mock('next/navigation', () => ({ usePathname: () => window.location.pathname, useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));
// In the canvas's frame, where every edit happens (#1283).
const mockHost = { displayId: null, dashboardId: null, switches: [], settings: {}, settingsUpdatedAt: null };
jest.mock('@/lib/displays/remoteEdit', () => ({
  ...jest.requireActual('@/lib/displays/remoteEdit'),
  remoteEditHost: () => mockHost,
}));

const hall = { id: 'hall', slug: 'hall', name: 'Hallway', isDefault: false, orientation: 'landscape', widgets: [], screensaverWidgets: null } as unknown as Layout;
const main = { id: 'main', slug: 'main', name: 'Main', isDefault: true, orientation: 'landscape', widgets: [], screensaverWidgets: null } as unknown as Layout;

const fetchMock = jest.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, json: async () => ({}) }));
/** Requests that change something; reads (the household's settings) are fine. */
const writes = () => fetchMock.mock.calls.filter(([, init]) => init?.method && init.method !== 'GET');
const saveLayout = jest.fn(async () => ({}));

async function editing() {
  const layouts = { savedLayout: main, saveLayout, deleteLayout: jest.fn(), allLayouts: [main, hall], loading: false };
  const hook = renderHook(() => useDashboardLayout(layouts, 'hall'));
  await waitFor(() => expect(hook.result.current.isEditing).toBe(true));
  return hook;
}

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockClear();
  saveLayout.mockClear();
  global.fetch = fetchMock as unknown as typeof fetch;
});

it('the screen shape is held until Done, then saved with the dashboard', async () => {
  const { result } = await editing();
  act(() => result.current.setEditingOrientation('portrait'));
  expect(result.current.editingOrientation).toBe('portrait');
  expect(result.current.lookDirty).toBe(true);
  expect(saveLayout).not.toHaveBeenCalled();
  expect(writes()).toHaveLength(0);

  await act(async () => { await result.current.handleSave(); });
  expect(saveLayout).toHaveBeenCalledTimes(1);
  expect(saveLayout).toHaveBeenCalledWith(expect.objectContaining({ id: 'hall', orientation: 'portrait' }));
});

it('Make the default is held until Done, then saved as the default, with no reload', async () => {
  const { result } = await editing();
  act(() => result.current.makeDefault());
  expect(result.current.defaultDirty).toBe(true);
  expect(saveLayout).not.toHaveBeenCalled();
  expect(writes()).toHaveLength(0);

  // Edits made after it are kept: nothing reloads under them.
  act(() => result.current.setEditingWidgets([{ i: 'clock', x: 0, y: 0, w: 8, h: 8, visible: true }]));
  await act(async () => { await result.current.handleSave(); });
  expect(saveLayout).toHaveBeenCalledWith(expect.objectContaining({
    id: 'hall', isDefault: true, widgets: [expect.objectContaining({ i: 'clock' })],
  }));
});

it('Cancel sends nothing and puts both back', async () => {
  const { result } = await editing();
  act(() => {
    result.current.setEditingOrientation('portrait');
    result.current.makeDefault();
  });
  act(() => result.current.handleCancel());
  expect(saveLayout).not.toHaveBeenCalled();
  expect(writes()).toHaveLength(0);
  expect(result.current.editingOrientation).toBe('landscape');
  expect(result.current.defaultDirty).toBe(false);
  expect(result.current.lookDirty).toBe(false);
});
