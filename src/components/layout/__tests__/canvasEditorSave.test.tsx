/**
 * @jest-environment jsdom
 *
 * One save rule (#1341), on the editor page. A device nobody has named holds
 * its own screen settings there, as a named screen's are held: Done writes
 * them to this browser, and Cancel leaves the browser as it was. A named
 * screen gets nothing until Done, and Save and switch goes on to the other
 * screen's editor.
 */
import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { CanvasEditor } from '../CanvasEditor';
import { REMOTE_EDIT_GLOBAL, type RemoteEditHost } from '@/lib/displays/remoteEdit';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: jest.fn() }) }));
jest.mock('@/components/providers', () => ({
  useAuth: () => ({ activeUser: { id: 'p', role: 'parent' }, requireAuth: jest.fn() }),
}));
const hallway = { id: 'hall', slug: 'hallway', name: 'Hallway', isDefault: false, widgets: [] };
jest.mock('@/lib/hooks/useLayouts', () => ({ useLayouts: () => ({ layouts: [hallway], loading: false }) }));
jest.mock('@/components/providers/TimeFormatProvider', () => ({
  useTimeFormat: () => ({ timeFormat: '24h', householdTimezone: 'America/Chicago' }),
}));

const fetchMock = jest.fn(async (url: string, _init?: RequestInit) => ({
  ok: true,
  json: async () => (url === '/api/displays'
    ? { displays: [{ id: 'main', name: 'Main', online: true, dashboardId: null, switches: [], settings: { 'prism-perf-mode': 'full' }, width: 1280, height: 800 }] }
    : {}),
}));

const host = () => (window as unknown as Record<string, RemoteEditHost | undefined>)[REMOTE_EDIT_GLOBAL];
/** Every write but the "being edited" note. */
const writes = () => fetchMock.mock.calls.filter(([url, init]) => init?.method && init.method !== 'GET' && !String(url).endsWith('/editing'));
const patches = () => fetchMock.mock.calls.filter(([url, init]) => init?.method === 'PATCH' && url === '/api/displays/main');

beforeAll(() => {
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} })) as never;
});
beforeEach(() => {
  localStorage.clear();
  push.mockClear();
  fetchMock.mockClear();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('a device nobody has named (/edit/[id])', () => {
  async function open() {
    localStorage.setItem('prism-perf-mode', 'full');
    render(<CanvasEditor dashboardId="hall" />);
    await waitFor(() => expect(host()).toBeDefined());
    const h = host()!;
    expect(h.displayId).toBeNull();
    // Starts from this device's own settings.
    expect(h.settings['prism-perf-mode']).toBe('full');
    // A setting changed in the frame lands in the host, not the browser.
    h.settings['prism-perf-mode'] = 'minimal';
    expect(h.pending?.()).toEqual({ keys: ['prism-perf-mode'], plan: false });
    return h;
  }

  it('Cancel leaves this browser\'s settings as they were', async () => {
    const h = await open();
    await act(async () => { h.onFinish(false); });
    expect(localStorage.getItem('prism-perf-mode')).toBe('full');
    expect(writes()).toHaveLength(0);
    expect(push).toHaveBeenCalledWith('/d/hallway');
  });

  it('Done writes them to this browser', async () => {
    const h = await open();
    await act(async () => { h.onFinish(true); });
    expect(localStorage.getItem('prism-perf-mode')).toBe('minimal');
  });
});

describe('a named screen (/screens/[id])', () => {
  async function open() {
    render(<CanvasEditor screenId="main" />);
    await waitFor(() => expect(host()?.displayId).toBe('main'));
    return host()!;
  }

  it('Cancel sends nothing', async () => {
    const h = await open();
    h.settings['prism-perf-mode'] = 'minimal';
    await act(async () => { h.onFinish(false); });
    expect(patches()).toHaveLength(0);
    expect(localStorage.getItem('prism-perf-mode')).toBeNull();
    expect(writes()).toHaveLength(0);
  });

  it('Save and switch: Done sends the changes, then opens the other screen\'s editor', async () => {
    const h = await open();
    h.settings['prism-perf-mode'] = 'minimal';
    h.next = '/screens/hall';
    await act(async () => { h.onFinish(true); });
    expect(patches()).toHaveLength(1);
    expect(JSON.parse(String(patches()[0]![1]!.body))).toEqual({ settings: { 'prism-perf-mode': 'minimal' } });
    expect(push).toHaveBeenCalledWith('/screens/hall');
  });
});
