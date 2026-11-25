/**
 * @jest-environment jsdom
 *
 * The Screen tab's unsaved dot (#1326): it shows when the screen's dashboard,
 * switches, own settings or idle looks differ from when the editor page
 * opened, as the Widgets tab shows its own. Every tab has one (#1341). And
 * every control on the Screen tab waits for Done (#1349): nothing reaches the
 * browser's storage or the server before it.
 */
import React, { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { LayoutEditor } from '../LayoutEditor';
import { remoteStorage, type RemoteEditHost } from '@/lib/displays/remoteEdit';
import type { IdleBackground } from '@/lib/idleBackground';
import type { ScreenPlan } from '@/lib/screenSwitches';

let unsaved = false;
let pending: { keys: string[]; plan: boolean } | null = null;
/** A real host for the Done test; otherwise the plain one below. */
let realHost: RemoteEditHost | null = null;
jest.mock('@/lib/displays/remoteEdit', () => ({
  ...jest.requireActual('@/lib/displays/remoteEdit'),
  remoteEditHost: () => realHost ?? ({
    displayId: 'kitchen', dashboardId: null, switches: [], settings: {}, unsaved: () => unsaved,
    ...(pending ? { pending: () => pending } : {}),
  }),
  remotePortalRoot: () => undefined,
}));
jest.mock('@/components/screensaver/useIdleBackground', () => ({
  useSkyLocation: () => ({ lat: 45, lon: -100 }),
}));
jest.mock('@/components/providers/TimeFormatProvider', () => ({
  useTimeFormat: () => ({ timeFormat: '24h', householdTimezone: 'America/Chicago' }),
}));

const dotOn = (tab: string) => document.querySelector(`[data-editor-open="${tab}"] [aria-label="unsaved changes"]`);
const dot = () => dotOn('screen');
const dotted = () => ['screen', 'dashboard', 'widgets', 'look', 'more'].filter((t) => dotOn(t));

beforeEach(() => {
  unsaved = false;
  pending = null;
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ displays: [{ id: 'kitchen', name: 'Kitchen' }] }) })) as never;
});

it('marks the Screen tab when the screen has changes Done has not sent', async () => {
  const props = {
    widgets: [], onWidgetsChange: () => {}, onSave: async () => {}, onSaveAs: () => {}, onReset: () => {}, onCancel: () => {},
    screenId: 'kitchen', screenPlan: { dashboardId: null, switches: [] }, onScreenPlanChange: () => {},
    allDashboards: [{ id: 'a', name: 'Home', slug: 'home', isDefault: true }], currentDashboardId: 'a',
  };
  const { rerender } = render(<LayoutEditor {...props} />);
  await act(async () => {});
  expect(dot()).toBeNull();
  // A switch added: the plan the editor holds changes, and the host says so.
  unsaved = true;
  rerender(<LayoutEditor {...props} screenPlan={{ dashboardId: null, switches: [{ when: 'bus', dashboardId: 'a' }] }} />);
  expect(dot()).not.toBeNull();
});

it('a setting changed on the Screen tab shows the dot at once', async () => {
  render(<LayoutEditor widgets={[]} onWidgetsChange={() => {}} onSave={async () => {}} onSaveAs={() => {}} onReset={() => {}} onCancel={() => {}}
    screenId="kitchen" screenPlan={{ dashboardId: null, switches: [] }}
    allDashboards={[{ id: 'a', name: 'Home', slug: 'home', isDefault: true }]} currentDashboardId="a" />);
  await act(async () => {});
  fireEvent.click(document.querySelector<HTMLElement>('[data-editor-open="screen"]')!);
  await act(async () => {});
  expect(dot()).toBeNull();
  unsaved = true;
  fireEvent.change(screen.getByLabelText('Idle after'), { target: { value: '3600' } });
  expect(dot()).not.toBeNull();
});

describe('every tab shows its own dot (#1341)', () => {
  const props = {
    widgets: [], onWidgetsChange: () => {}, onSave: async () => {}, onSaveAs: () => {}, onReset: () => {}, onCancel: () => {},
    screenId: 'kitchen', screenPlan: { dashboardId: null, switches: [] },
    allDashboards: [{ id: 'a', name: 'Hallway', slug: 'hallway', isDefault: false }], currentDashboardId: 'a',
  };

  it('none with nothing changed', async () => {
    pending = { keys: [], plan: false };
    render(<LayoutEditor {...props} />);
    await act(async () => {});
    expect(dotted()).toEqual([]);
  });

  it('Dashboard, once Make the default is pressed', async () => {
    render(<LayoutEditor {...props} defaultPending />);
    await act(async () => {});
    expect(dotted()).toEqual(['dashboard']);
  });

  it('Look, for the screen shape only: the screen\'s options are on Screen now (#1349)', async () => {
    const { rerender } = render(<LayoutEditor {...props} lookDirty />);
    await act(async () => {});
    expect(dotted()).toEqual(['look']);
    pending = { keys: ['prism-perf-mode'], plan: false };
    rerender(<LayoutEditor {...props} />);
    expect(dotted()).toEqual(['screen']);
  });

  it('Screen, for every one of its settings, notices included, and its idle looks; Widgets for the photo frame', async () => {
    pending = { keys: ['prism-screen-attention'], plan: false };
    const { rerender } = render(<LayoutEditor {...props} />);
    await act(async () => {});
    expect(dotted()).toEqual(['screen']);
    pending = { keys: [], plan: false };
    rerender(<LayoutEditor {...props} screenDayDirty />);
    expect(dotted()).toEqual(['screen']);
    rerender(<LayoutEditor {...props} idleDirty idleLayoutDirty />);
    expect(dotted()).toEqual(['widgets']);
  });
});

describe('every control on the Screen tab waits for Done (#1341, #1349)', () => {
  const HOME = '11111111-1111-4111-8111-111111111111';
  const BUS = '22222222-2222-4222-8222-222222222222';
  let real: Storage;
  let sent: Array<{ url: string; method: string }>;
  beforeEach(() => {
    real = window.localStorage;
    real.clear();
    sent = [];
    realHost = {
      displayId: 'hallway', dashboardId: null, switches: [], settings: {}, settingsUpdatedAt: null,
      root: document.body, onDashboard: () => {}, onFinish: () => {},
      pending: () => ({ keys: Object.keys(realHost!.settings), plan: realHost!.switches.length > 0 }),
    };
    // What the frame does on a canvas: the screen's settings live in the host.
    const shim = remoteStorage(real, realHost);
    Object.defineProperty(window, 'localStorage', { configurable: true, get: () => shim });
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      sent.push({ url, method: init?.method ?? 'GET' });
      if (url === '/api/displays') return { ok: true, json: async () => ({ displays: [{ id: 'hallway', name: 'Hallway' }] }) };
      if (url === '/api/bus-tracking/status') return { ok: true, json: async () => ({ routes: [] }) };
      return { ok: true, json: async () => ({}) };
    }) as never;
  });
  afterEach(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get: () => real });
    realHost = null;
  });

  it('writes nothing to the browser or the server until Done, and the Through the day tab is gone', async () => {
    const onSave = jest.fn(async () => {});
    const seen: { idle?: IdleBackground; plan?: ScreenPlan } = {};
    function Editor() {
      const [idle, setIdle] = useState<IdleBackground>({ source: 'dashboard' });
      const [plan, setPlan] = useState<ScreenPlan>({ dashboardId: null, switches: [] });
      seen.idle = idle;
      seen.plan = plan;
      return (
        <LayoutEditor widgets={[]} onWidgetsChange={() => {}} onSave={onSave} onSaveAs={() => {}} onReset={() => {}} onCancel={() => {}}
          screenId="hallway" screenPlan={plan} onScreenPlanChange={(p) => { setPlan(p); realHost!.switches = p.switches; }}
          idleBackground={idle} onIdleBackgroundChange={setIdle}
          allDashboards={[{ id: HOME, name: 'Main', slug: 'main', isDefault: true }, { id: BUS, name: 'Bus board', slug: 'bus-board', isDefault: false }]}
          currentDashboardId={HOME} />
      );
    }
    render(<Editor />);
    await act(async () => {});
    expect(document.querySelector('[data-editor-open="day"]')).toBeNull();
    expect(screen.queryByText(/Through the day/)).toBeNull();
    fireEvent.click(document.querySelector<HTMLElement>('[data-editor-open="screen"]')!);
    await act(async () => {});

    // Every kind of control on the tab.
    const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
    change('Idle after', '600');
    change('By day it shows', 'photos');
    change('At night it shows', 'sky');
    change('Darker at night', '0.75');
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Light or dark' })).getByRole('radio', { name: 'Dark' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Photos behind the dashboard' }));
    fireEvent.click(screen.getByRole('button', { name: /^Advanced: when night is/ }));
    change('Night is', 'clock');
    change('Transition effect', 'fade');
    fireEvent.click(screen.getByRole('switch', { name: 'Outlines on the photo frame' }));
    fireEvent.click(screen.getByRole('button', { name: /^Advanced: orientation/ }));
    change('Performance', 'reduced');
    fireEvent.click(screen.getByRole('button', { name: 'Add a time' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Normally' }));
    change('Normally', BUS);

    // The tab says what it will do...
    expect(document.querySelector('[data-screen-sentence]')!.textContent).toMatch(/^Hallway shows Bus board\..* Idle for 10 minutes, it becomes a photo frame\. At night it becomes the night sky, 75% darker\.$/);
    // ...but nothing is in the browser's own storage, nothing went to the
    // server, and nothing was saved: it is all held for Done.
    expect(real.length).toBe(0);
    expect(sent.filter((r) => r.method !== 'GET')).toEqual([]);
    expect(onSave).not.toHaveBeenCalled();
    expect(realHost!.settings).toMatchObject({
      'prism-screensaver-timeout': '600', 'prism-theme': 'dark', 'prism-wallpaper-enabled': 'false',
      'prism-screensaver-motion': 'fade', 'prism-screensaver-outlines': 'off', 'prism-perf-mode': 'reduced',
    });
    expect(JSON.parse(realHost!.settings['prism-screen-day']!)).toMatchObject({ nightLevel: 75 });
    expect(seen.idle).toEqual({ day: 'photos', night: 'sky', switch: { by: 'clock', from: '21:00', to: '06:30' } });
    expect(seen.plan).toMatchObject({ dashboardId: BUS, switches: [{ when: 'times' }] });
    expect(dotted()).toEqual(['screen']);

    await act(async () => { fireEvent.click(document.querySelector<HTMLElement>('[data-editor-done]')!); });
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
