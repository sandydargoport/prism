/**
 * @jest-environment jsdom
 *
 * The Screen tab's unsaved dot (#1326): it shows when the screen's dashboard,
 * switches, own settings or idle looks differ from when the editor page
 * opened, as the Widgets tab shows its own. Every tab has one (#1341). And
 * every control on the Screen tab waits for Done (#1349): nothing reaches the
 * browser's storage or the server before it.
 *
 * The editor's shell (#1350): a header with the screen, Editing and the
 * dashboard's jobs in a menu, and three tabs, Screen | Widgets | Look, with
 * no Screen tab on a dashboard edited with no screen. Each control of the
 * Dashboard, More and old Look tabs, and Settings > Text Size, has one home.
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
// A widget's own settings read the theme.
jest.mock('@/components/providers', () => ({
  ...jest.requireActual('@/components/providers'),
  useTheme: () => ({ resolvedTheme: 'light' }),
}));
jest.mock('@/components/screensaver/useIdleBackground', () => ({
  useSkyLocation: () => ({ lat: 45, lon: -100 }),
}));
jest.mock('@/components/providers/TimeFormatProvider', () => ({
  useTimeFormat: () => ({ timeFormat: '24h', householdTimezone: 'America/Chicago' }),
}));

const dotOn = (tab: string) => document.querySelector(`[data-editor-open="${tab}"] [aria-label="unsaved changes"]`);
const dot = () => dotOn('screen');
const tabSet = () => Array.from(document.querySelectorAll('[data-editor-open]')).map((t) => t.getAttribute('data-editor-open'));
const dotted = () => tabSet().filter((t) => dotOn(t!));

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

  it('none for Show on new and unnamed screens, which is in the header menu: Unsaved changes says it beside Done (#1350)', async () => {
    pending = { keys: [], plan: false };
    const { rerender } = render(<LayoutEditor {...props} />);
    await act(async () => {});
    expect(document.querySelector('[data-editor-unsaved]')).toBeNull();
    rerender(<LayoutEditor {...props} defaultPending />);
    expect(dotted()).toEqual([]);
    expect(document.querySelector('[data-editor-unsaved]')!.textContent).toBe('Unsaved changes');
  });

  it('Look, for the text size: the screen\'s options are on Screen (#1349, #1350)', async () => {
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

describe('the editor shell (#1350)', () => {
  const MAIN = { id: 'a', name: 'Main', slug: 'main', isDefault: true };
  const BUS = { id: 'b', name: 'Bus board', slug: 'bus-board', isDefault: false };
  const GLANCE = { id: 'g', name: 'Glance', slug: 'glance', isDefault: false, view: 'today' };
  const WIDGETS = [
    { i: 'clock', x: 0, y: 0, w: 8, h: 8, outlineColor: 'transparent' },
    { i: 'tasks', x: 8, y: 0, w: 8, h: 8 },
    { i: 'weather', x: 16, y: 0, w: 8, h: 8 },
  ];
  const base = {
    widgets: WIDGETS, onWidgetsChange: () => {}, onSave: async () => {}, onSaveAs: () => {}, onReset: () => {}, onCancel: () => {},
    allDashboards: [MAIN, BUS], currentDashboardId: 'a', layoutName: 'Main',
  };
  const onScreen = { ...base, screenId: 'kitchen', screenPlan: { dashboardId: null, switches: [] } };
  const open = async (tab: string) => {
    fireEvent.click(document.querySelector<HTMLElement>(`[data-editor-open="${tab}"]`)!);
    await act(async () => {});
  };
  const menu = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard jobs' }));
    return Array.from(screen.getByRole('menu').querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
  };

  it('has three tabs, Screen | Widgets | Look, and no Dashboard, More or Through the day', async () => {
    render(<LayoutEditor {...onScreen} />);
    await act(async () => {});
    expect(tabSet()).toEqual(['screen', 'widgets', 'look']);
    expect(Array.from(document.querySelectorAll('[data-editor-open]')).map((t) => t.textContent)).toEqual(['Screen', 'Widgets', 'Look']);
  });

  it('opened on a dashboard with no screen, has no Screen tab', async () => {
    render(<LayoutEditor {...base} deviceNamed />);
    await act(async () => {});
    expect(tabSet()).toEqual(['widgets', 'look']);
    expect(document.querySelector('[data-screen-sheet]')).toBeNull();
  });

  it('a device nobody named keeps its Screen tab, to set its idle rows and be named', async () => {
    render(<LayoutEditor {...base} deviceNamed={false} />);
    await act(async () => {});
    expect(tabSet()).toEqual(['screen', 'widgets', 'look']);
  });

  it('the header names the screen, says which dashboard is Editing, and Editing opens another', async () => {
    const onSwitchDashboard = jest.fn();
    render(<LayoutEditor {...onScreen} onSwitchDashboard={onSwitchDashboard} />);
    await act(async () => {});
    const header = document.querySelector<HTMLElement>('[data-editor-header]')!;
    const pick = within(header).getByLabelText('Screen') as HTMLSelectElement;
    expect(pick.options[pick.selectedIndex]!.textContent).toBe('Kitchen screen');
    expect(within(header).getByRole('button', { name: 'Rename Kitchen' })).toBeTruthy();
    const editing = within(header).getByLabelText('Editing') as HTMLSelectElement;
    expect(Array.from(editing.options).map((o) => o.textContent)).toEqual(['Main dashboard', 'Bus board dashboard']);
    expect(editing.value).toBe('a');
    fireEvent.change(editing, { target: { value: 'b' } });
    await act(async () => {});
    expect(onSwitchDashboard).toHaveBeenCalledWith('bus-board');
  });

  it('the header menu holds the dashboard\'s jobs, in order', async () => {
    render(<LayoutEditor {...onScreen} onMakeDefault={() => {}} />);
    await act(async () => {});
    expect(menu().map((m) => m.textContent)).toEqual([
      'New dashboard', 'Make a copy', 'Rename', 'Export', 'Import', 'Share to the gallery', 'Shown on new and unnamed screens', 'Reset', 'Delete',
    ]);
  });

  it('on Glance: no Rename, Import or Share; Delete is off and says why; Reset puts Glance back', async () => {
    const onResetBuiltIn = jest.fn();
    render(<LayoutEditor {...onScreen} allDashboards={[GLANCE, MAIN]} currentDashboardId="g" layoutName="Glance" view="today" onResetBuiltIn={onResetBuiltIn} />);
    await act(async () => {});
    const items = menu();
    expect(items.map((m) => m.textContent)).toEqual(['New dashboard', 'Make a copy', 'Export', 'Reset', 'Delete']);
    const del = items.find((m) => m.textContent === 'Delete')!;
    expect(del.disabled).toBe(true);
    expect(del.title).toBe('Glance is built in and cannot be deleted');
    expect(document.querySelector('[data-dashboard-menu-note]')!.textContent).toMatch(/^Glance is built in\./);
    fireEvent.click(items.find((m) => m.textContent === 'Reset')!);
    expect(onResetBuiltIn).toHaveBeenCalledTimes(1);
  });

  it('a menu job does its own job and closes the menu: Show on new screens waits for Done, Rename opens its dialog', async () => {
    const onMakeDefault = jest.fn();
    render(<LayoutEditor {...onScreen} allDashboards={[{ ...MAIN, isDefault: false }, { ...BUS, isDefault: true }]} onMakeDefault={onMakeDefault} />);
    await act(async () => {});
    (global.fetch as jest.Mock).mockClear();
    fireEvent.click(menu().find((m) => m.textContent === 'Show on new and unnamed screens')!);
    expect(onMakeDefault).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
    fireEvent.click(menu().find((m) => m.textContent === 'Rename')!);
    expect(screen.getByDisplayValue('Main')).toBeTruthy();
  });

  it('each tab opens with its scope line', async () => {
    render(<LayoutEditor {...onScreen} />);
    await act(async () => {});
    await open('screen');
    expect(document.querySelector('[data-screen-scope]')!.textContent).toBe('Kitchen · This screen');
    await open('widgets');
    expect(document.querySelector('[data-editor-sheet="widgets"] [data-editor-scope]')!.textContent).toBe('Main · Every screen that shows it');
    await open('look');
    expect(document.querySelector('[data-editor-sheet="look"] [data-editor-scope]')!.textContent).toBe('Main · Every screen that shows it');
  });

  it('Look holds the text size in its 13 steps, held for Done, and one fill, outline and text for all widgets', async () => {
    const onFontScaleChange = jest.fn();
    const onWidgetsChange = jest.fn();
    render(<LayoutEditor {...onScreen} fontScale={110} onFontScaleChange={onFontScaleChange} onWidgetsChange={onWidgetsChange} />);
    await act(async () => {});
    await open('look');
    const size = screen.getByLabelText('Text size') as HTMLSelectElement;
    expect(Array.from(size.options).map((o) => o.textContent)).toEqual(
      ['75%', '80%', '85%', '90%', '95%', '100%', '105%', '110%', '115%', '120%', '130%', '140%', '150%']);
    expect(size.value).toBe('110');
    (global.fetch as jest.Mock).mockClear();
    fireEvent.change(size, { target: { value: '130' } });
    expect(onFontScaleChange).toHaveBeenCalledWith(130);
    expect(global.fetch).not.toHaveBeenCalled();

    // Outline: two of three have the theme's, so that is what it offers; one differs.
    const outline = screen.getByLabelText('Outline for all widgets') as HTMLSelectElement;
    expect(outline.value).toBe('');
    expect(document.querySelector('[data-all-widgets-note="outline"]')!.textContent).toBe('1 widget has a different outline.');
    fireEvent.change(outline, { target: { value: 'transparent' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply this outline to all widgets' }));
    expect(onWidgetsChange).toHaveBeenCalledWith(WIDGETS.map((w) => expect.objectContaining({ i: w.i, outlineColor: 'transparent' })));
    expect(screen.getByLabelText('Fill for all widgets')).toBeTruthy();
    expect(screen.getByLabelText('Text for all widgets')).toBeTruthy();
  });

  it('on Glance, Look has the text size only', async () => {
    render(<LayoutEditor {...onScreen} allDashboards={[GLANCE]} currentDashboardId="g" layoutName="Glance" view="today" />);
    await act(async () => {});
    await open('look');
    expect(screen.getByLabelText('Text size')).toBeTruthy();
    expect(screen.queryByLabelText(/for all widgets$/)).toBeNull();
    expect(document.querySelector('[data-look-glance]')!.textContent).toBe('Glance has no cards.');
  });

  it('the selected widget has a Stays when idle switch on Widgets', async () => {
    const onWidgetsChange = jest.fn();
    render(<LayoutEditor {...onScreen} selectedWidgetId="tasks" onWidgetsChange={onWidgetsChange} />);
    await act(async () => {});
    const stays = within(document.querySelector<HTMLElement>('[data-editor-sheet="widgets"]')!).getByRole('switch', { name: 'Stays when idle' });
    expect(stays.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(stays);
    expect(onWidgetsChange).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ i: 'tasks', showWhenIdle: true })]));
  });

  it('what the old tabs held is gone: Screen shape, See it at a screen size, Overview, Use while resting', async () => {
    render(<LayoutEditor {...onScreen} idleBackground={{ source: 'photos' }} onMakeDefault={() => {}} />);
    await act(async () => {});
    for (const tab of ['screen', 'widgets', 'look']) {
      await open(tab);
      expect(screen.queryByText(/Screen shape|See it at a screen size|Overview|Use while resting|Use as the dashboard|Make the default/)).toBeNull();
    }
    menu();
    expect(screen.queryByText(/Reset this layout|Make the default/)).toBeNull();
  });

  it('arranging the photo frame, Widgets says so, with Copy from the dashboard and Back to the dashboard', async () => {
    const onEditTabChange = jest.fn();
    render(<LayoutEditor {...onScreen} editTab="idle" editingScreensaver screensaverWidgets={[]} idleBackground={{ source: 'photos' }}
      onSelectScreensaverTemplate={() => {}} onEditTabChange={onEditTabChange} />);
    await act(async () => {});
    const banner = document.querySelector<HTMLElement>('[data-photo-frame-banner]')!;
    expect(within(banner).getByRole('button', { name: 'Copy from the dashboard' })).toBeTruthy();
    fireEvent.click(within(banner).getByRole('button', { name: 'Back to the dashboard' }));
    expect(onEditTabChange).toHaveBeenCalledWith('dashboard');
  });
});
