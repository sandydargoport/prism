/**
 * @jest-environment jsdom
 *
 * One save rule (#1341): the text size (#1350) waits for Done like everything
 * else in the editor. Nothing reaches the server before Done, and Cancel sends
 * nothing at all. Which dashboard new and unnamed screens show is not the
 * editor's: Settings > Screens sets it (#1351), and Done never sends it.
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

it('the text size picked on Look is held until Done, then saved with the dashboard (#1350)', async () => {
  const { result } = await editing();
  expect(result.current.editingFontScale).toBe(100);
  act(() => result.current.setEditingFontScale(130));
  expect(result.current.editingFontScale).toBe(130);
  expect(result.current.lookDirty).toBe(true);
  expect(saveLayout).not.toHaveBeenCalled();
  expect(writes()).toHaveLength(0);

  await act(async () => { await result.current.handleSave(); });
  expect(saveLayout).toHaveBeenCalledTimes(1);
  expect(saveLayout).toHaveBeenCalledWith(expect.objectContaining({ id: 'hall', fontScale: 130 }));
});

it('an unchanged text size is not sent', async () => {
  const { result } = await editing();
  await act(async () => { await result.current.handleSave(); });
  expect((saveLayout.mock.calls[0] as unknown[])[0]).not.toHaveProperty('fontScale');
});

it('Done never sends which dashboard new and unnamed screens show, so what Settings > Screens set stays (#1351)', async () => {
  const { result } = await editing();
  expect(result.current).not.toHaveProperty('makeDefault');
  act(() => result.current.setEditingWidgets([{ i: 'clock', x: 0, y: 0, w: 8, h: 8, visible: true }]));
  await act(async () => { await result.current.handleSave(); });
  expect(saveLayout).toHaveBeenCalledTimes(1);
  expect((saveLayout.mock.calls[0] as unknown[])[0]).not.toHaveProperty('isDefault');
});

it('Cancel sends nothing and puts the text size back', async () => {
  const { result } = await editing();
  act(() => {
    result.current.setEditingFontScale(80);
  });
  act(() => result.current.handleCancel());
  expect(saveLayout).not.toHaveBeenCalled();
  expect(writes()).toHaveLength(0);
  expect(result.current.editingFontScale).toBe(100);
  expect(result.current.lookDirty).toBe(false);
});
