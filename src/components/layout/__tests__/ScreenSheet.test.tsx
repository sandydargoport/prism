/**
 * @jest-environment jsdom
 *
 * The editor's Screen sheet (#1326), first in the bar: the screen being
 * edited, renamed here; the dashboard it shows and the dashboards it switches
 * to at bus time or at set times (#1282, #1291), a row each, kept on the
 * editor page until Done; its own Rest after and How dark; and the other
 * named screens, to edit one of them instead. A device nobody named is
 * offered a name (#1267). A dashboard edited with no screen says so.
 */
import React, { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { openOtherScreen, ScreenSheet } from '../ScreenSheet';
import { EditorBar } from '../EditorBar';
import type { IdleBackground } from '@/lib/idleBackground';
import type { ScreenPlan } from '@/lib/screenSwitches';

jest.mock('@/components/providers/TimeFormatProvider', () => ({
  useTimeFormat: () => ({ timeFormat: '24h', householdTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
}));
jest.mock('@/lib/displays/displaySettingsSync', () => ({
  resetSyncBase: () => {},
  syncScreenSettings: async () => ({ applied: [], planChanged: false }),
}));

const HOME = '11111111-1111-4111-8111-111111111111';
const BUS = '22222222-2222-4222-8222-222222222222';
const DASHBOARDS = [
  { id: HOME, name: 'Home', slug: 'home', isDefault: true },
  { id: BUS, name: 'Bus', slug: 'bus', isDefault: false },
];
const PLAIN: ScreenPlan = { dashboardId: null, switches: [] };
const AM_ROUTE = '33333333-3333-4333-8333-333333333333';
const PM_ROUTE = '44444444-4444-4444-8444-444444444444';
/** A morning run due at the stop at 7:45 and an afternoon one at 3:30, on weekdays. */
const ROUTES = [
  { id: AM_ROUTE, label: 'Morning', scheduledTime: '07:45', activeDays: [1, 2, 3, 4, 5] },
  { id: PM_ROUTE, label: 'Afternoon', scheduledTime: '15:30', activeDays: [1, 2, 3, 4, 5] },
];
/** Two named screens: the one edited, and another. */
const SCREENS = [{ id: 'kitchen', name: 'Kitchen' }, { id: 'hall', name: 'Hall' }];

let patched: Array<{ url: string; body: unknown }> = [];
let posted: unknown[] = [];
/** The server: named screens, bus routes, renames and naming. */
function server(routes = ROUTES, screens = SCREENS) {
  patched = [];
  posted = [];
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      patched.push({ url, body: JSON.parse(String(init.body)) });
      return { ok: true, json: async () => ({}) };
    }
    if (init?.method === 'POST') {
      posted.push(JSON.parse(String(init.body)));
      return { ok: true, json: async () => ({ display: { id: 'den', name: 'Den' } }) };
    }
    if (url === '/api/displays') return { ok: true, json: async () => ({ displays: screens }) };
    if (url === '/api/bus-tracking/status') return { ok: true, json: async () => ({ routes }) };
    return { ok: true, json: async () => ({}) };
  }) as never;
}

const seen: { plan?: ScreenPlan | null } = {};
const named = jest.fn();
const switched = jest.fn();
const picked = jest.fn();
const renamed = jest.fn();

function Harness({ plan = PLAIN, screenId = 'kitchen', forScreen = true, deviceNamed = true, openSwitch = null, idle = { source: 'photos' } }: {
  plan?: ScreenPlan | null; screenId?: string | null; forScreen?: boolean; deviceNamed?: boolean; openSwitch?: number | null; idle?: IdleBackground;
}) {
  const [screenPlan, setScreenPlan] = useState<ScreenPlan | null>(plan);
  React.useEffect(() => { seen.plan = screenPlan; });
  return (
    <ScreenSheet
      idleBackground={idle}
      allDashboards={DASHBOARDS as never}
      currentDashboardId={HOME}
      onSwitchDashboard={switched}
      screenPlan={screenPlan}
      onScreenPlanChange={setScreenPlan}
      screenId={screenId}
      forScreen={forScreen}
      deviceNamed={deviceNamed}
      onDeviceNamed={named}
      openSwitch={openSwitch}
      onPickScreen={picked}
      onRenamed={renamed}
    />
  );
}

/** Renders and lets the named screens (and bus routes) load. */
async function show(props: Parameters<typeof Harness>[0] = {}) {
  render(<Harness {...props} />);
  await act(async () => {});
}

const kept = () => seen.plan!.switches;
const rows = () => Array.from(document.querySelectorAll<HTMLElement>('[data-switch-row]'));
const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const pick = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const unfold = (row: Element) => fireEvent.click(row.querySelector<HTMLElement>('[data-fold-toggle]')!);
const openRows = () => Array.from(document.querySelectorAll('[data-open="true"]'));
const summary = (row: Element) => row.querySelector('[data-fold-summary]')!.textContent;

beforeEach(() => {
  server();
  // Only the date is faked: a new switch starts at this quarter hour.
  jest.useFakeTimers({ now: new Date(2026, 10, 23, 7, 5), doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'queueMicrotask', 'nextTick'] });
});
afterEach(() => {
  jest.useRealTimers();
  localStorage.clear();
  for (const f of [named, switched, picked, renamed]) f.mockReset();
});

describe('the Screen tab (#1326)', () => {
  it('is the first tab in the editor\'s bar, before Dashboard', () => {
    render(<EditorBar open="screen" onOpenChange={() => {}} onDone={() => {}} onCancel={() => {}} sheet={<p>sheet</p>} />);
    const tabs = Array.from(document.querySelectorAll('[data-editor-open]')).map((t) => t.getAttribute('data-editor-open'));
    expect(tabs).toEqual(['screen', 'dashboard', 'widgets', 'day', 'look', 'more']);
    expect(screen.getAllByRole('button')[2]!.textContent).toBe('Screen');
    expect(document.querySelector('[data-editor-sheet]')!.getAttribute('aria-label')).toBe('Screen');
  });

  it('starts with a Screen drop-down set to the one edited, then its base dashboard, switches, and When nobody is using it', async () => {
    await show({ plan: { dashboardId: BUS, switches: [{ when: 'times', days: [1], from: '07:00', to: '08:00', dashboardId: HOME }] } });
    const sheet = document.querySelector('[data-screen-sheet]')!;
    // The drop-down is the first control on the sheet, listing every named screen.
    const pickScreen = screen.getByLabelText('Screen') as HTMLSelectElement;
    expect(sheet.querySelector('select, input, button')).toBe(pickScreen);
    expect(pickScreen.value).toBe('kitchen');
    expect(Array.from(pickScreen.options).map((o) => o.textContent)).toEqual(['Kitchen', 'Hall']);
    // No row of its own for the name: a pencil beside the drop-down renames it.
    expect(screen.queryByLabelText('Name of screen')).toBeNull();
    expect(screen.getByRole('button', { name: 'Rename Kitchen' })).toBeTruthy();
    expect((screen.getByLabelText('Base dashboard') as HTMLSelectElement).value).toBe(BUS);
    expect(screen.getByText('Shown except while a switch is on.')).toBeTruthy();
    expect(Array.from(sheet.querySelectorAll('[data-field-label]')).map((n) => n.textContent))
      .toEqual(['Screen', 'Base dashboard', 'Rest after', 'How dark']);
    expect(Array.from(sheet.querySelectorAll('[data-screen-heading]')).map((n) => n.textContent))
      .toEqual(['Switches', 'When nobody is using it']);
    // In this order: the Screen row (drop-down and pencil), Base dashboard, Switches, When nobody is using it.
    expect(Array.from(sheet.querySelectorAll('[data-field-label], [data-screen-heading], [data-screen-rename]'))
      .map((n) => n.textContent || n.getAttribute('aria-label')))
      .toEqual(['Screen', 'Rename Kitchen', 'Base dashboard', 'Switches', 'When nobody is using it', 'Rest after', 'How dark']);
    // The switch rows and the add buttons sit under Switches.
    const switchesSection = sheet.querySelector('[data-screen-plan]')!;
    expect(switchesSection.querySelector('[data-screen-heading]')!.textContent).toBe('Switches');
    expect(switchesSection.querySelectorAll('[data-switch-row], [data-switch-add]')).toHaveLength(3);
    // No picker at the bottom.
    expect(screen.queryByLabelText('Edit another screen')).toBeNull();
    expect(sheet.querySelector('[data-screen-own]')!.textContent).toContain('at night');
    fireEvent.change(screen.getByLabelText('Rest after'), { target: { value: '3600' } });
    expect(localStorage.getItem('prism-screensaver-timeout')).toBe('3600');
    fireEvent.change(screen.getByLabelText('How dark at night'), { target: { value: '0.75' } });
    expect(localStorage.getItem('prism-screensaver-dim')).toBe('0.75');
  });

  it('with the screen off at night, there is nothing to dim', async () => {
    await show({ idle: { day: 'photos', night: 'off', switch: { by: 'clock', from: '21:00', to: '06:30' } } });
    expect(screen.getByLabelText('Rest after')).toBeTruthy();
    expect(screen.queryByLabelText('How dark at night')).toBeNull();
  });

  const nameField = () => screen.getByLabelText('Name of this screen') as HTMLInputElement;
  const pencil = () => fireEvent.click(screen.getByRole('button', { name: /^Rename / }));
  const pickScreen = () => document.querySelector<HTMLSelectElement>('[data-screen-pick]');

  it('the pencil swaps the drop-down for the name, focused and selected; Enter saves it and the drop-down comes back with it', async () => {
    await show();
    pencil();
    expect(pickScreen()).toBeNull();
    expect(nameField().value).toBe('Kitchen');
    expect(document.activeElement).toBe(nameField());
    expect([nameField().selectionStart, nameField().selectionEnd]).toEqual([0, 'Kitchen'.length]);
    fireEvent.change(nameField(), { target: { value: 'Kitchen wall' } });
    expect(patched).toEqual([]);
    await act(async () => { fireEvent.submit(nameField().closest('form')!); });
    expect(patched).toEqual([{ url: '/api/displays/kitchen', body: { name: 'Kitchen wall' } }]);
    expect(screen.queryByLabelText('Name of this screen')).toBeNull();
    expect(pickScreen()!.value).toBe('kitchen');
    expect(Array.from(pickScreen()!.options).map((o) => o.textContent)).toEqual(['Kitchen wall', 'Hall']);
    expect(screen.getByRole('button', { name: 'Rename Kitchen wall' })).toBeTruthy();
    expect(renamed).toHaveBeenCalledWith('Kitchen wall');
  });

  it('Esc cancels a rename: nothing is sent, and the drop-down comes back', async () => {
    await show();
    pencil();
    fireEvent.change(nameField(), { target: { value: 'Den' } });
    await act(async () => { fireEvent.keyDown(nameField(), { key: 'Escape' }); });
    expect(screen.queryByLabelText('Name of this screen')).toBeNull();
    expect(pickScreen()!.options[pickScreen()!.selectedIndex]!.textContent).toBe('Kitchen');
    expect(patched).toEqual([]);
    expect(renamed).not.toHaveBeenCalled();
  });

  it('leaving the field saves the name; an unchanged or empty one sends nothing', async () => {
    await show();
    pencil();
    await act(async () => { fireEvent.blur(nameField()); });
    expect(pickScreen()).not.toBeNull();
    pencil();
    fireEvent.change(nameField(), { target: { value: '  ' } });
    await act(async () => { fireEvent.blur(nameField()); });
    expect(patched).toEqual([]);
    pencil();
    fireEvent.change(nameField(), { target: { value: 'Den' } });
    await act(async () => { fireEvent.blur(nameField()); });
    expect(patched).toEqual([{ url: '/api/displays/kitchen', body: { name: 'Den' } }]);
    expect(renamed).toHaveBeenCalledWith('Den');
  });

  it('a rename the server refuses says why, and keeps the field to try again', async () => {
    await show();
    global.fetch = jest.fn(async () => ({ ok: false, status: 403, json: async () => ({}) })) as never;
    pencil();
    fireEvent.change(nameField(), { target: { value: 'Den' } });
    await act(async () => { fireEvent.submit(nameField().closest('form')!); });
    expect(screen.getByRole('alert').textContent).toBe('Only a parent can rename a screen.');
    expect(nameField().value).toBe('Den');
    expect(renamed).not.toHaveBeenCalled();
  });

  it('there is no pencil with no screen or on a device not named', async () => {
    const { unmount } = render(<Harness screenId={null} forScreen={false} plan={null} />);
    await act(async () => {});
    expect(screen.queryByRole('button', { name: /^Rename/ })).toBeNull();
    unmount();
    await show({ screenId: null, forScreen: false, plan: null, deviceNamed: false });
    expect(screen.queryByRole('button', { name: /^Rename/ })).toBeNull();
  });

  it('picking another screen in the drop-down edits it', async () => {
    await show();
    pick('Screen', 'hall');
    expect(picked).toHaveBeenCalledWith('hall');
  });

  it('a dashboard edited with no screen says so in the drop-down, and still lists the screens', async () => {
    await show({ screenId: null, forScreen: false, plan: null });
    expect(document.querySelector('[data-no-screen]')!.textContent).toBe('No screen is being edited, so this edits Home on its own.');
    expect(document.querySelector('[data-screen-plan], [data-switch-add], [data-screen-name]')).toBeNull();
    expect(screen.queryByLabelText('Rest after')).toBeNull();
    const pickScreen = screen.getByLabelText('Screen') as HTMLSelectElement;
    expect(Array.from(pickScreen.options).map((o) => o.textContent)).toEqual(['No screen', 'Kitchen', 'Hall']);
    expect(pickScreen.value).toBe('');
    pick('Screen', 'kitchen');
    expect(picked).toHaveBeenCalledWith('kitchen');
  });

  it('on a device not named, the drop-down says so, above Name this device', async () => {
    await show({ screenId: null, forScreen: false, plan: null, deviceNamed: false });
    const pickScreen = screen.getByLabelText('Screen') as HTMLSelectElement;
    expect(pickScreen.options[0]!.textContent).toBe('This device (not named)');
    expect(pickScreen.compareDocumentPosition(screen.getByRole('button', { name: 'Name this device' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('opening another screen\'s editor (#1326)', () => {
  it('goes to that screen\'s editor, as Settings > Screens > Edit does', async () => {
    const go = jest.fn();
    const confirm = jest.fn(async () => true);
    expect(await openOtherScreen('hall', { unsaved: false, confirm, go })).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    expect(go).toHaveBeenCalledWith('/screens/hall');
  });

  it('with changes not saved, asks first, and stays when told to', async () => {
    const go = jest.fn();
    const stay = jest.fn(async () => false);
    expect(await openOtherScreen('hall', { unsaved: true, confirm: stay, go })).toBe(false);
    expect(stay).toHaveBeenCalledWith('Leave without saving?', expect.stringMatching(/Done/), expect.objectContaining({ confirmLabel: 'Leave' }));
    expect(go).not.toHaveBeenCalled();
    await openOtherScreen('hall', { unsaved: true, confirm: async () => true, go });
    expect(go).toHaveBeenCalledWith('/screens/hall');
  });
});

describe('a screen\'s dashboard and switches, on the Screen tab (#1282, #1326)', () => {
  it('+ Switch at set times adds a row on every day from this quarter hour, and its days and hours change in it', async () => {
    await show();
    press('Switch at set times');
    expect(kept()).toEqual([{ when: 'times', days: [0, 1, 2, 3, 4, 5, 6], from: '07:00', to: '08:00', dashboardId: BUS }]);
    expect(rows()).toHaveLength(1);
    // Weekdays: Saturday and Sunday off.
    const days = rows()[0]!.querySelector<HTMLElement>('[aria-label="Switch days"]')!;
    fireEvent.click(days.querySelector<HTMLElement>('[aria-label="Saturday"]')!);
    fireEvent.click(days.querySelector<HTMLElement>('[aria-label="Sunday"]')!);
    expect(kept()[0]).toMatchObject({ days: [1, 2, 3, 4, 5] });
    fireEvent.change(screen.getByLabelText('Switch ends'), { target: { value: '08:30' } });
    expect(kept()[0]).toMatchObject({ to: '08:30' });
    fireEvent.change(screen.getByLabelText('Switches to'), { target: { value: HOME } });
    expect(kept()[0]!.dashboardId).toBe(HOME);

    fireEvent.click(document.querySelector<HTMLElement>('[data-switch-remove]')!);
    expect(kept()).toEqual([]);
    expect(rows()).toHaveLength(0);
  });

  it('+ Switch at bus time adds one on every route, says when from the bus routes, and can add another', async () => {
    await show();
    await act(async () => { press('Switch at bus time'); });
    expect(kept()).toEqual([{ when: 'bus', dashboardId: BUS }]);
    expect(rows()[0]!.querySelector('[data-row-name]')!.textContent).toBe('At bus time');
    expect(document.querySelector('[data-bus-windows]')!.textContent).toBe('Mon–Fri 07:15 to 08:00, 15:00 to 15:45');
    // Another, say for the afternoon run to a dashboard of its own (#1291).
    press('Switch at bus time');
    expect(kept()).toHaveLength(2);
  });

  const busRow = () => rows()[0]!;
  const route = (id: string) => busRow().querySelector<HTMLButtonElement>(`[data-bus-route="${id}"]`)!;
  const windows = () => busRow().querySelector('[data-bus-windows]')!.textContent;
  const BUS_PLAN: ScreenPlan = { dashboardId: null, switches: [{ when: 'bus', dashboardId: BUS }] };

  it('a bus switch follows the routes picked on its row, and every route again with all of them on (#1291)', async () => {
    await show({ plan: BUS_PLAN });
    unfold(busRow());
    expect(route(AM_ROUTE).textContent).toBe('Morning 07:45');
    expect(route(AM_ROUTE).getAttribute('aria-pressed')).toBe('true');
    expect(route(PM_ROUTE).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(route(PM_ROUTE));
    expect(kept()).toEqual([{ when: 'bus', dashboardId: BUS, routeIds: [AM_ROUTE] }]);
    expect(windows()).toBe('Mon–Fri 07:15 to 08:00');
    // The last route on stays on; Remove takes the switch away.
    expect(route(AM_ROUTE).disabled).toBe(true);
    // Both on again: it follows every route, ones added later too.
    fireEvent.click(route(PM_ROUTE));
    expect(kept()).toEqual([{ when: 'bus', dashboardId: BUS }]);
  });

  it('a bus switch\'s minutes before and after move its windows (#1291)', async () => {
    await show({ plan: BUS_PLAN });
    unfold(busRow());
    expect((screen.getByLabelText('Minutes before the bus') as HTMLSelectElement).value).toBe('30');
    expect((screen.getByLabelText('Minutes after the bus') as HTMLSelectElement).value).toBe('15');
    pick('Minutes before the bus', '10');
    pick('Minutes after the bus', '5');
    expect(kept()).toEqual([{ when: 'bus', dashboardId: BUS, before: 10, after: 5 }]);
    expect(windows()).toBe('Mon–Fri 07:35 to 07:50, 15:20 to 15:35');
  });

  it('with one bus route there is no route to pick (#1291)', async () => {
    server(ROUTES.slice(0, 1));
    await show({ plan: BUS_PLAN });
    unfold(busRow());
    expect(busRow().querySelector('[data-bus-routes]')).toBeNull();
    expect(windows()).toBe('Mon–Fri 07:15 to 08:00');
  });

  it('at bus time with no route set up, it says it never switches', async () => {
    server([]);
    await show({ plan: BUS_PLAN });
    expect(summary(busRow())).toBe('No bus route set up yet · Bus');
    unfold(busRow());
    expect(document.querySelector('[data-bus-windows]')!.textContent).toMatch(/^No bus route is set up yet/);
  });

  it('a set-times switch keeps at least one day', async () => {
    await show({ plan: { dashboardId: null, switches: [{ when: 'times', days: [1], from: '07:00', to: '08:00', dashboardId: BUS }] } });
    unfold(rows()[0]!);
    expect((rows()[0]!.querySelector<HTMLButtonElement>('[aria-label="Monday"]')!).disabled).toBe(true);
  });

  it('moves a switch up the order that decides an overlap', async () => {
    await show({ plan: { dashboardId: null, switches: [
      { when: 'times', days: [0, 1, 2, 3, 4, 5, 6], from: '07:00', to: '09:00', dashboardId: HOME },
      { when: 'bus', dashboardId: BUS },
    ] } });
    expect(screen.getByText('If two overlap, the higher one wins.')).toBeTruthy();
    unfold(rows()[0]!);
    expect(rows()[0]!.querySelector('[data-switch-up]')).toBeNull();
    unfold(rows()[1]!);
    fireEvent.click(rows()[1]!.querySelector<HTMLElement>('[data-switch-up]')!);
    expect(kept().map((sw) => sw.when)).toEqual(['bus', 'times']);
    // The one moved stays open, now first.
    expect(rows()[0]!.getAttribute('data-open')).toBe('true');
    expect(rows()[1]!.getAttribute('data-open')).toBe('false');
  });

  it('Base dashboard is the dashboard the screen shows, and a switch\'s Open opens its dashboard on this tab', async () => {
    await show({ plan: BUS_PLAN });
    // None set: the default.
    expect((screen.getByLabelText('Base dashboard') as HTMLSelectElement).value).toBe(HOME);
    unfold(rows()[0]!);
    fireEvent.click(rows()[0]!.querySelector<HTMLElement>(`[data-dashboard-open="${BUS}"]`)!);
    expect(switched).toHaveBeenCalledWith('bus');
    // The editor that opens on it opens on Screen.
    expect(JSON.parse(sessionStorage.getItem('prism:canvas-panel-next')!)).toEqual({ panel: 'screen', dashboardId: BUS });
    pick('Base dashboard', BUS);
    expect(seen.plan!.dashboardId).toBe(BUS);
  });

  it('each switch folds to one line that says what it does, and one opens at a time (#1294)', async () => {
    await show({ plan: { dashboardId: null, switches: [
      { when: 'bus', dashboardId: BUS, routeIds: [AM_ROUTE] },
      { when: 'times', days: [1, 2, 3, 4, 5], from: '01:45', to: '02:45', dashboardId: HOME },
    ] } });
    expect(openRows()).toHaveLength(0);
    expect(document.querySelector('[data-switch-remove], [data-switch-up], [data-dashboard-open]')).toBeNull();
    expect(rows().map(summary)).toEqual(['Morning 07:15–08:00 · Bus', 'Mon–Fri 01:45–02:45 · Home']);
    unfold(rows()[0]!);
    expect(openRows()).toEqual([rows()[0]]);
    unfold(rows()[1]!);
    expect(openRows()).toEqual([rows()[1]]);
    unfold(rows()[1]!);
    expect(openRows()).toHaveLength(0);
  });

  it('opens at the switch whose dot was tapped on Through the day', async () => {
    await show({ openSwitch: 1, plan: { dashboardId: null, switches: [
      { when: 'bus', dashboardId: BUS },
      { when: 'times', days: [1], from: '01:45', to: '02:45', dashboardId: HOME },
    ] } });
    expect(openRows()).toEqual([rows()[1]]);
  });

  it('a switch just added opens, and the one that was open folds (#1294)', async () => {
    await show({ plan: { dashboardId: null, switches: [{ when: 'times', days: [1], from: '07:00', to: '08:00', dashboardId: BUS }] } });
    unfold(rows()[0]!);
    press('Switch at set times');
    expect(rows()).toHaveLength(2);
    expect(openRows()).toEqual([rows()[1]]);
    expect(rows()[1]!.querySelector('[aria-label="Switch starts"]')).toBeTruthy();
  });

  it('nothing about the schedule is sent until Done: every change stays on the editor page', async () => {
    await show();
    const sent = jest.fn(async () => ({ ok: true, json: async () => ({}) }));
    global.fetch = sent as never;
    press('Switch at set times');
    pick('Base dashboard', BUS);
    expect(sent).not.toHaveBeenCalled();
    expect(seen.plan).toMatchObject({ dashboardId: BUS });
  });
});

describe('naming the device in use, on the Screen tab (#1267, #1326)', () => {
  it('a device with no name is named here, and then opens as that screen', async () => {
    await show({ screenId: null, forScreen: false, plan: null, deviceNamed: false });
    expect(screen.getByText(/^This device has no name, so it shows Home\./)).toBeTruthy();
    await act(async () => { press('Name this device'); });
    // A screen named before can be picked instead, after a browser reset.
    expect(within(document.querySelector<HTMLElement>('[data-name-device-form]')!).getByRole('option', { name: 'Hall' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Name for this screen'), { target: { value: 'Den' } });
    await act(async () => { press('Name it'); });
    expect(posted).toEqual([{ name: 'Den' }]);
    expect(named).toHaveBeenCalledWith('den');
  });

  it('becomes a screen named before, taking its name', async () => {
    await show({ screenId: null, forScreen: false, plan: null, deviceNamed: false });
    await act(async () => { press('Name this device'); });
    fireEvent.change(screen.getByLabelText('Existing screen'), { target: { value: 'hall' } });
    await act(async () => { press('Use its name and settings'); });
    expect(posted).toEqual([{ id: 'hall' }]);
    expect(named).toHaveBeenCalledWith('den');
  });

  it('a device with a name, or a screen being edited, is not offered one', async () => {
    const { unmount } = render(<Harness screenId={null} forScreen={false} plan={null} />);
    await act(async () => {});
    expect(screen.queryByRole('button', { name: 'Name this device' })).toBeNull();
    unmount();
    await show({ deviceNamed: false });
    expect(screen.queryByRole('button', { name: 'Name this device' })).toBeNull();
  });
});
