/**
 * @jest-environment jsdom
 *
 * The editor's Screen tab (#1326, #1349): the screen's whole day. A scope
 * line and its sentence, the strip, then Shows (Normally and the switches at
 * bus time or set times, a row each, kept on the editor page until Done),
 * When idle (Idle after, By day and At night, Darker, and Advanced), This
 * screen (light or dark, photos behind) and its Advanced options. A device
 * nobody named keeps its idle rows and is asked for a name where a name is
 * needed. Which screen is edited, and its rename, are in the editor's header
 * (#1350).
 */
import React, { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ScreenSheet, simplest } from '../ScreenSheet';
import { EditorHeader, openOtherScreen, useScreens } from '../EditorHeader';
import { EditorBar } from '../EditorBar';
import { idleSaveProblem } from '../IdleBackgroundBar';
import { busWindowsInWords } from '../sheetRows';
import type { IdleBackground } from '@/lib/idleBackground';
import type { ScreenPlan } from '@/lib/screenSwitches';
import { DEFAULT_NIGHT } from '@/lib/throughTheDay';

jest.mock('@/components/providers/TimeFormatProvider', () => ({
  useTimeFormat: () => ({ timeFormat: '24h', householdTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
}));
jest.mock('@/components/screensaver/useIdleBackground', () => ({
  useSkyLocation: () => ({ lat: 45, lon: -100 }),
}));
jest.mock('@/lib/displays/displaySettingsSync', () => ({
  resetSyncBase: () => {},
  syncScreenSettings: async () => ({ applied: [], planChanged: false }),
  loadBase: () => null,
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

const seen: { plan?: ScreenPlan | null; idle?: IdleBackground; shown?: boolean[]; arranged?: boolean[] } = {};
const named = jest.fn();
const switched = jest.fn();
const picked = jest.fn();
const renamed = jest.fn();
const made = jest.fn(async (name: string) => (name ? 'new-id' : null));

function Harness({ plan = PLAIN, screenId = 'kitchen', deviceNamed = true, idle = { source: 'photos' }, canIdle = true, dashboards = DASHBOARDS }: {
  plan?: ScreenPlan | null; screenId?: string | null; deviceNamed?: boolean; idle?: IdleBackground; canIdle?: boolean; dashboards?: typeof DASHBOARDS;
}) {
  const [screenPlan, setScreenPlan] = useState<ScreenPlan | null>(plan);
  const [background, setBackground] = useState<IdleBackground>(idle);
  React.useEffect(() => { seen.plan = screenPlan; seen.idle = background; });
  return (
    <ScreenSheet
      idleBackground={background}
      onIdleBackgroundChange={setBackground}
      onShowIdle={(night) => seen.shown!.push(night)}
      onArrangePhotoFrame={(night) => seen.arranged!.push(night)}
      canIdle={canIdle}
      allDashboards={dashboards as never}
      currentDashboardId={HOME}
      onSwitchDashboard={switched}
      onNewDashboard={made}
      screenPlan={screenPlan}
      onScreenPlanChange={setScreenPlan}
      screenId={screenId}
      screenName={screenId ? SCREENS.find((s) => s.id === screenId)?.name ?? null : null}
      deviceNamed={deviceNamed}
      onDeviceNamed={named}
    />
  );
}

/** The editor's header and the Screen tab, sharing the screens as the editor does (#1350). */
function WithHeader({ screenId = 'kitchen', deviceNamed = true }: { screenId?: string | null; deviceNamed?: boolean }) {
  const [screens, setScreens] = useScreens();
  return (
    <>
      <EditorHeader screenId={screenId} deviceNamed={deviceNamed} screens={screens} onScreensChange={setScreens}
        onPickScreen={picked} onRenamed={renamed} dashboards={DASHBOARDS} currentDashboardId={HOME} onPickDashboard={() => {}} jobs={[]} />
      {screenId && <ScreenSheet screenId={screenId} screenName={screens?.find((s) => s.id === screenId)?.name ?? null}
        screenPlan={PLAIN} allDashboards={DASHBOARDS} currentDashboardId={HOME} idleBackground={{ source: 'photos' }} />}
    </>
  );
}

async function showHeader(props: Parameters<typeof WithHeader>[0] = {}) {
  const r = render(<WithHeader {...props} />);
  await act(async () => {});
  return r;
}

/** Renders and lets the named screens (and bus routes) load. */
async function show(props: Parameters<typeof Harness>[0] = {}) {
  const r = render(<Harness {...props} />);
  await act(async () => {});
  return r;
}

const kept = () => seen.plan!.switches;
const rows = () => Array.from(document.querySelectorAll<HTMLElement>('[data-switch-row]'));
const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const pick = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const unfold = (row: Element) => fireEvent.click(row.querySelector<HTMLElement>('[data-row-edit]')!);
const openRows = () => Array.from(document.querySelectorAll('[data-switch-row][data-open="true"], [data-normally-row][data-open="true"]'));
const summary = (row: Element) => row.querySelector('[data-row-summary]')!.textContent;
const normally = () => document.querySelector<HTMLElement>('[data-normally-row]')!;
const sentence = () => document.querySelector('[data-screen-sentence]')!.textContent;

beforeEach(() => {
  server();
  seen.shown = [];
  seen.arranged = [];
  // Only the date is faked: a new switch starts at this quarter hour.
  jest.useFakeTimers({ now: new Date(2026, 10, 23, 7, 5), doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'queueMicrotask', 'nextTick'] });
});
afterEach(() => {
  jest.useRealTimers();
  localStorage.clear();
  for (const f of [named, switched, picked, renamed, made]) f.mockClear();
});

describe('the Screen tab (#1326, #1349)', () => {
  it('is the first tab, and there is no Through the day tab', () => {
    render(<EditorBar open="screen" onOpenChange={() => {}} onDone={() => {}} onCancel={() => {}} sheet={<p>sheet</p>} />);
    const tabs = Array.from(document.querySelectorAll('[data-editor-open]')).map((t) => t.getAttribute('data-editor-open'));
    expect(tabs).toEqual(['screen', 'widgets', 'look']);
    expect(screen.queryByText(/Through the day/)).toBeNull();
    expect(document.querySelector('[data-editor-sheet]')!.getAttribute('aria-label')).toBe('Screen');
  });

  it('in order: the scope line, the sentence, the strip, Shows, When idle, This screen, Advanced', async () => {
    await show({ plan: { dashboardId: BUS, switches: [{ when: 'times', days: [1, 2, 3, 4, 5], from: '16:00', to: '18:00', dashboardId: HOME }] } });
    const sheet = document.querySelector('[data-screen-sheet]')!;
    const parts = Array.from(sheet.querySelectorAll('[data-screen-scope], [data-screen-sentence], [data-day-strip], [data-screen-heading], [data-disclosure-toggle]'))
      .map((n) => n.getAttribute('data-screen-scope') !== null ? 'scope' : n.hasAttribute('data-screen-sentence') ? 'sentence'
        : n.hasAttribute('data-day-strip') ? 'strip' : n.textContent);
    expect(parts).toEqual(['scope', 'sentence', 'strip', 'Shows', 'When idle', 'Advanced: when night is, photo frame motion and timing',
      'This screen: light or dark, photos behind the dashboard', 'Advanced: orientation, performance, keyboard, auto-hide, sign out, notices']);
    expect(sheet.querySelector('[data-screen-scope]')!.textContent).toBe('Kitchen · This screen');
    expect(sentence()).toBe('Kitchen shows Bus. Mon to Fri, 16:00 to 18:00 it shows Home. Idle for 2 minutes, it becomes a photo frame. At night nothing changes.');
    // Normally first, then the switch, each with its swatch, name, words and Edit.
    expect(Array.from(sheet.querySelectorAll('[data-row-name]')).map((n) => n.textContent)).toEqual(['Normally', 'Set times']);
    expect(summary(normally())).toBe('Bus');
    expect(summary(rows()[0]!)).toBe('Home · Mon to Fri, 16:00 to 18:00');
    expect(screen.getByText('Higher rows win where times overlap. Times are in the household time zone.')).toBeTruthy();
    expect(screen.getByText('Night changes how the screen idles. To show a different dashboard in the evening, add a time above.')).toBeTruthy();
  });

  it('the sentence follows each control, before Done', async () => {
    await show({ idle: { day: 'photos', night: 'photos', switch: DEFAULT_NIGHT } });
    pick('Darker at night', '0.5');
    expect(sentence()).toMatch(/Idle for 2 minutes, it becomes a photo frame\. At night the photo frame is 50% darker\.$/);
    pick('Idle after', '0');
    expect(sentence()).toMatch(/It never idles, so it has no night look\.$/);
  });

  it('Idle after, then By day and At night: what it shows, and how much darker at night', async () => {
    await show();
    const after = screen.getByLabelText('Idle after') as HTMLSelectElement;
    expect(after.options[after.selectedIndex]!.textContent).toBe('2 min');
    expect(Array.from(after.options).map((o) => o.textContent)).toEqual(['30 sec', '1 min', '2 min', '10 min', '1 hour', 'Never']);
    expect(document.querySelector('[data-idle-head="night"]')!.textContent).toBe('At night (dusk to dawn)');
    const day = screen.getByLabelText('By day it shows') as HTMLSelectElement;
    expect(Array.from(day.options).map((o) => o.textContent)).toEqual(['The dashboard, quieter', 'A photo frame', 'The night sky']);
    const night = screen.getByLabelText('At night it shows') as HTMLSelectElement;
    expect(night.value).toBe('same');
    expect(Array.from(night.options).map((o) => o.textContent)).toEqual(['Same as by day', 'The dashboard, quieter', 'The night sky', 'Screen off']);
    // Same as by day follows the day's look.
    pick('By day it shows', 'sky');
    expect(seen.idle).toEqual({ source: 'sky' });
    expect(seen.shown).toEqual([false]);
    pick('At night it shows', 'off');
    expect(seen.idle).toEqual({ day: 'sky', night: 'off', switch: DEFAULT_NIGHT });
    expect(seen.shown).toEqual([false, true]);
    // Screen off has nothing to make darker.
    expect(screen.queryByLabelText('Darker at night')).toBeNull();
    pick('At night it shows', 'same');
    expect(seen.idle).toEqual({ source: 'sky' });
    expect(Array.from((screen.getByLabelText('Darker at night') as HTMLSelectElement).options).map((o) => o.textContent))
      .toEqual(['Not darker', '25%', '50%', '75%']);
  });

  it('a screen that never idles greys the night column and says why', async () => {
    localStorage.setItem('prism-screensaver-timeout', '0');
    await show();
    expect((screen.getByLabelText('By day it shows') as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText('At night it shows') as HTMLSelectElement).disabled).toBe(true);
    expect(screen.queryByLabelText('Darker at night')).toBeNull();
    expect(document.querySelector('[data-never-idles]')!.textContent).toBe('This screen never idles, so it has no night look.');
    expect(document.querySelector('[data-idle-head="night"]')!.className).toMatch(/text-muted-foreground\/50/);
  });

  it('one too narrow to idle says so, and so does its sentence', async () => {
    await show({ canIdle: false });
    expect(document.querySelector('[data-never-idles]')!.textContent).toMatch(/too narrow to idle/);
    expect(sentence()).toMatch(/Will not idle: too narrow\.$/);
  });

  it('a photo frame offers Arrange the photo frame, by day or at night', async () => {
    await show({ idle: { source: 'dashboard' } });
    expect(screen.queryByRole('button', { name: 'Arrange the photo frame' })).toBeNull();
    pick('At night it shows', 'photos');
    press('Arrange the photo frame');
    expect(seen.arranged).toEqual([true]);
    pick('By day it shows', 'photos');
    press('Arrange the photo frame');
    expect(seen.arranged).toEqual([true, false]);
  });

  it('when night is sits under Advanced, with tonight\'s times and the offsets', async () => {
    await show({ idle: { day: 'photos', night: 'sky', switch: DEFAULT_NIGHT } });
    expect(screen.queryByLabelText('Night is')).toBeNull();
    press('Advanced: when night is, photo frame motion and timing');
    expect(document.querySelector('[data-night-times]')!.textContent).toMatch(/^Tonight \d\d:\d\d to \d\d:\d\d\.$/);
    fireEvent.change(screen.getByLabelText('Starts: amount'), { target: { value: '60' } });
    expect(seen.idle).toMatchObject({ switch: { by: 'sun', duskOffset: 60 } });
    pick('Night is', 'clock');
    expect(seen.idle).toEqual({ day: 'photos', night: 'sky', switch: { by: 'clock', from: '21:00', to: '06:30' } });
    expect(document.querySelector('[data-idle-head="night"]')!.textContent).toBe('At night (21:00 to 06:30)');
    fireEvent.change(screen.getByLabelText('Night ends'), { target: { value: '07:00' } });
    expect(seen.idle).toMatchObject({ switch: { from: '21:00', to: '07:00' } });
    // The photo frame's motion, inline, with its outlines.
    expect(screen.getByLabelText('Transition effect')).toBeTruthy();
    expect(screen.getByLabelText('Outlines on the photo frame')).toBeTruthy();
    expect(screen.queryByText(/Start after|Settings shortcut/)).toBeNull();
  });

  // #1340: light or dark and the photos behind the dashboard are the screen's own.
  it("This screen sets the screen's Light or Dark, and its photos behind the dashboard, never System", async () => {
    await show();
    const mode = screen.getByRole('radiogroup', { name: 'Light or dark' });
    expect(within(mode).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Light', 'Dark']);
    fireEvent.click(within(mode).getByRole('radio', { name: 'Dark' }));
    expect(localStorage.getItem('prism-theme')).toBe('dark');
    expect(within(mode).getByRole('radio', { name: 'Dark' }).getAttribute('aria-checked')).toBe('true');
    pick('New photo every', '300');
    expect(localStorage.getItem('prism-wallpaper-interval')).toBe('300');
    fireEvent.click(screen.getByRole('switch', { name: 'Photos behind the dashboard' }));
    expect(localStorage.getItem('prism-wallpaper-enabled')).toBe('false');
    expect(screen.queryByLabelText('New photo every')).toBeNull();
  });

  it('its Advanced holds orientation, performance, keyboard, auto-hide, sign out', async () => {
    await show();
    press('Advanced: orientation, performance, keyboard, auto-hide, sign out, notices');
    const options = document.querySelector('[data-screen-options]')!;
    expect(Array.from(options.querySelectorAll('[data-screen-option] > span')).map((n) => n.textContent))
      .toEqual(['Orientation', 'Performance', 'On-screen keyboard', 'Auto-hide navigation', 'Sign out after']);
    pick('Performance', 'reduced');
    expect(localStorage.getItem('prism-perf-mode')).toBe('reduced');
  });
});

describe('the header\'s screen drop-down and rename, at once (#1326, #1350)', () => {
  const nameField = () => screen.getByLabelText('Name of this screen') as HTMLInputElement;
  const pencil = () => fireEvent.click(screen.getByRole('button', { name: /^Rename / }));
  const pickScreen = () => document.querySelector<HTMLSelectElement>('[data-screen-pick]');

  it('the pencil swaps the drop-down for the name, focused and selected; Enter saves it and the drop-down comes back with it', async () => {
    await showHeader();
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
    expect(Array.from(pickScreen()!.options).map((o) => o.textContent)).toEqual(['Kitchen wall screen', 'Hall screen']);
    expect(document.querySelector('[data-screen-scope]')!.textContent).toBe('Kitchen wall · This screen');
    expect(renamed).toHaveBeenCalledWith('Kitchen wall');
  });

  it('Esc cancels a rename: nothing is sent, and the drop-down comes back', async () => {
    await showHeader();
    pencil();
    fireEvent.change(nameField(), { target: { value: 'Den' } });
    await act(async () => { fireEvent.keyDown(nameField(), { key: 'Escape' }); });
    expect(screen.queryByLabelText('Name of this screen')).toBeNull();
    expect(pickScreen()!.options[pickScreen()!.selectedIndex]!.textContent).toBe('Kitchen screen');
    expect(patched).toEqual([]);
    expect(renamed).not.toHaveBeenCalled();
  });

  it('leaving the field saves the name; an unchanged or empty one sends nothing', async () => {
    await showHeader();
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
    await showHeader();
    global.fetch = jest.fn(async () => ({ ok: false, status: 403, json: async () => ({}) })) as never;
    pencil();
    fireEvent.change(nameField(), { target: { value: 'Den' } });
    await act(async () => { fireEvent.submit(nameField().closest('form')!); });
    expect(screen.getByRole('alert').textContent).toBe('Only a parent can rename a screen.');
    expect(nameField().value).toBe('Den');
    expect(renamed).not.toHaveBeenCalled();
  });

  it('picking another screen in the drop-down edits it', async () => {
    await showHeader();
    pick('Screen', 'hall');
    expect(picked).toHaveBeenCalledWith('hall');
  });

  it('with no screen, the drop-down says so and still lists the screens, with no rename', async () => {
    await showHeader({ screenId: null });
    expect(screen.queryByRole('button', { name: /^Rename/ })).toBeNull();
    const list = screen.getByLabelText('Screen') as HTMLSelectElement;
    expect(Array.from(list.options).map((o) => o.textContent)).toEqual(['No screen', 'Kitchen screen', 'Hall screen']);
    pick('Screen', 'kitchen');
    expect(picked).toHaveBeenCalledWith('kitchen');
  });

  it('on a device nobody named, the drop-down says Not named yet', async () => {
    await showHeader({ screenId: null, deviceNamed: false });
    const list = screen.getByLabelText('Screen') as HTMLSelectElement;
    expect(list.options[list.selectedIndex]!.textContent).toBe('Not named yet');
  });
});

describe('opening another screen\'s editor (#1326, #1341)', () => {
  it('goes to that screen\'s editor, as Settings > Screens > Edit does', async () => {
    const go = jest.fn();
    const ask = jest.fn(async () => 'stay' as const);
    const save = jest.fn(async () => {});
    expect(await openOtherScreen('hall', { unsaved: false, ask, save, go })).toBe(true);
    expect(ask).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(go).toHaveBeenCalledWith('/screens/hall');
  });

  it('with changes not saved, Stay stays', async () => {
    const go = jest.fn();
    const save = jest.fn(async () => {});
    expect(await openOtherScreen('hall', { unsaved: true, ask: async () => 'stay', save, go })).toBe(false);
    expect(go).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('with changes not saved, Discard goes without saving', async () => {
    const go = jest.fn();
    const save = jest.fn(async () => {});
    expect(await openOtherScreen('hall', { unsaved: true, ask: async () => 'discard', save, go })).toBe(true);
    expect(save).not.toHaveBeenCalled();
    expect(go).toHaveBeenCalledWith('/screens/hall');
  });

  it('with changes not saved, Save and switch saves, and the save goes on to that screen', async () => {
    const go = jest.fn();
    const save = jest.fn(async () => {});
    expect(await openOtherScreen('hall', { unsaved: true, ask: async () => 'save', save, go })).toBe(true);
    expect(save).toHaveBeenCalledWith('/screens/hall');
    expect(go).not.toHaveBeenCalled();
  });
});

describe('Shows: Normally and the switches (#1282, #1326, #1349)', () => {
  it('Normally offers Same as new screens, which stores null, and each dashboard', async () => {
    await show({ plan: { dashboardId: BUS, switches: [] } });
    expect(summary(normally())).toBe('Bus');
    unfold(normally());
    const select = screen.getByLabelText('Normally') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['Same as new screens (Home)', 'Home', 'Bus']);
    expect(select.value).toBe(BUS);
    pick('Normally', '');
    expect(seen.plan!.dashboardId).toBeNull();
    expect(summary(normally())).toBe('Same as new screens (Home)');
    pick('Normally', HOME);
    expect(seen.plan!.dashboardId).toBe(HOME);
  });

  it('+ Add a time adds a row on every day from this quarter hour, and its days and hours change in it', async () => {
    await show();
    press('Add a time');
    expect(kept()).toEqual([{ when: 'times', days: [0, 1, 2, 3, 4, 5, 6], from: '07:00', to: '08:00', dashboardId: BUS }]);
    expect(rows()).toHaveLength(1);
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

  it('a switch\'s picker makes a New dashboard... in place and switches to it', async () => {
    await show({ plan: { dashboardId: null, switches: [{ when: 'times', days: [1], from: '07:00', to: '08:00', dashboardId: BUS }] } });
    unfold(rows()[0]!);
    const to = screen.getByLabelText('Switches to') as HTMLSelectElement;
    expect(Array.from(to.options).map((o) => o.textContent)).toEqual(['Home', 'Bus', 'New dashboard...']);
    pick('Switches to', '__new');
    fireEvent.change(screen.getByLabelText('Name of the new dashboard'), { target: { value: 'School run' } });
    await act(async () => { press('Make it'); });
    expect(made).toHaveBeenCalledWith('School run');
    expect(kept()[0]!.dashboardId).toBe('new-id');
    expect(screen.queryByLabelText('Name of the new dashboard')).toBeNull();
  });

  it('+ Add bus time adds one on every route, lists the routes and days, and can add another', async () => {
    await show();
    await act(async () => { press('Add bus time'); });
    expect(kept()).toEqual([{ when: 'bus', dashboardId: BUS }]);
    expect(rows()[0]!.querySelector('[data-row-name]')!.textContent).toBe('Bus time');
    expect(summary(rows()[0]!)).toBe('Bus · Morning 07:45 and Afternoon 15:30, school days · 30 min before to 15 after each run · stays awake');
    expect(document.querySelector('[data-bus-windows]')!.textContent).toBe('Mon–Fri 07:15 to 08:00, 15:00 to 15:45');
    expect(sentence()).toMatch(/^Kitchen shows Home\. On school days it shows Bus around bus time and stays awake for it\./);
    press('Add bus time');
    expect(kept()).toHaveLength(2);
  });

  const busRow = () => rows()[0]!;
  const route = (id: string) => busRow().querySelector<HTMLButtonElement>(`[data-bus-route="${id}"]`)!;
  const windows = () => busRow().querySelector('[data-bus-windows]')!.textContent;
  const BUS_PLAN: ScreenPlan = { dashboardId: null, switches: [{ when: 'bus', dashboardId: BUS }] };

  it('+ Add bus time is offered only with bus tracking set up; Add a time always', async () => {
    server([]);
    await show();
    expect(screen.queryByRole('button', { name: 'Add bus time' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Add a time' })).toBeTruthy();
  });

  it('a bus switch made before still shows with no route set up, and says it never switches', async () => {
    server([]);
    await show({ plan: BUS_PLAN });
    expect(rows()).toHaveLength(1);
    expect(summary(busRow())).toBe('Bus · no bus route set up yet · 30 min before to 15 after each run · stays awake');
    expect(sentence()).toContain('No bus route is set up, so it never shows Bus.');
    unfold(busRow());
    expect(windows()).toMatch(/^No bus route is set up yet/);
  });

  it('a bus switch follows the routes picked on its row, and every route again with all of them on (#1291)', async () => {
    await show({ plan: BUS_PLAN });
    unfold(busRow());
    expect(route(AM_ROUTE).textContent).toBe('Morning 07:45');
    fireEvent.click(route(PM_ROUTE));
    expect(kept()).toEqual([{ when: 'bus', dashboardId: BUS, routeIds: [AM_ROUTE] }]);
    expect(windows()).toBe('Mon–Fri 07:15 to 08:00');
    expect(route(AM_ROUTE).disabled).toBe(true);
    fireEvent.click(route(PM_ROUTE));
    expect(kept()).toEqual([{ when: 'bus', dashboardId: BUS }]);
  });

  it('a bus row lists each route with its days when they differ', async () => {
    server([ROUTES[0]!, { ...ROUTES[1]!, activeDays: [3] }]);
    await show({ plan: BUS_PLAN });
    expect(summary(busRow())).toBe('Bus · Morning 07:45 school days, Afternoon 15:30 Wed · 30 min before to 15 after each run · stays awake');
  });

  it('a bus switch\'s minutes before and after move its windows (#1291)', async () => {
    await show({ plan: BUS_PLAN });
    unfold(busRow());
    pick('Minutes before the bus', '10');
    pick('Minutes after the bus', '5');
    expect(kept()).toEqual([{ when: 'bus', dashboardId: BUS, before: 10, after: 5 }]);
    expect(windows()).toBe('Mon–Fri 07:35 to 07:50, 15:20 to 15:35');
  });

  it('Stays awake: on for bus time and off for set times, turned either way on the row, and said in its line (#1347)', async () => {
    await show({ plan: { dashboardId: null, switches: [
      { when: 'bus', dashboardId: BUS, routeIds: [AM_ROUTE] },
      { when: 'times', days: [1, 2, 3, 4, 5], from: '01:45', to: '02:45', dashboardId: HOME },
    ] } });
    const awake = (row: Element) => within(row as HTMLElement).getByRole('switch', { name: 'Stays awake' });
    unfold(rows()[0]!);
    expect(awake(rows()[0]!).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(awake(rows()[0]!));
    expect(kept()[0]).toEqual({ when: 'bus', dashboardId: BUS, routeIds: [AM_ROUTE], staysAwake: false });
    expect(summary(rows()[0]!)).toBe('Bus · Morning 07:45, school days · 30 min before to 15 after each run');
    unfold(rows()[1]!);
    fireEvent.click(awake(rows()[1]!));
    expect(kept()[1]).toMatchObject({ when: 'times', staysAwake: true });
    expect(summary(rows()[1]!)).toBe('Home · Mon to Fri, 01:45 to 02:45 · stays awake');
  });

  it('moves a switch up the order that decides an overlap, and a covered row says so', async () => {
    await show({ plan: { dashboardId: null, switches: [
      { when: 'times', days: [0, 1, 2, 3, 4, 5, 6], from: '07:00', to: '09:00', dashboardId: HOME },
      { when: 'times', days: [1, 2, 3, 4, 5], from: '07:30', to: '08:00', dashboardId: BUS },
      { when: 'times', days: [1], from: '08:30', to: '10:00', dashboardId: BUS },
    ] } });
    const covered = (i: number) => rows()[i]!.querySelector('[data-row-covered]')?.textContent ?? null;
    expect(covered(0)).toBeNull();
    expect(covered(1)).toBe('Covered by Set times (Home) above, so it never shows.');
    expect(covered(2)).toBe('Set times (Home) above wins where they overlap.');
    unfold(rows()[0]!);
    expect(rows()[0]!.querySelector('[data-switch-up]')).toBeNull();
    unfold(rows()[1]!);
    fireEvent.click(rows()[1]!.querySelector<HTMLElement>('[data-switch-up]')!);
    expect(kept().map((sw) => sw.dashboardId)).toEqual([BUS, HOME, BUS]);
    expect(rows()[0]!.getAttribute('data-open')).toBe('true');
    expect(covered(0)).toBeNull();
    expect(covered(1)).toBe('Set times (Bus) above wins where they overlap.');
  });

  it('a switch\'s Open opens its dashboard on this tab', async () => {
    await show({ plan: BUS_PLAN });
    unfold(rows()[0]!);
    fireEvent.click(rows()[0]!.querySelector<HTMLElement>(`[data-dashboard-open="${BUS}"]`)!);
    expect(switched).toHaveBeenCalledWith('bus');
    expect(JSON.parse(sessionStorage.getItem('prism:canvas-panel-next')!)).toEqual({ panel: 'screen', dashboardId: BUS });
  });

  it('every row is folded on open, one opens at a time, and one just added opens', async () => {
    await show({ plan: { dashboardId: null, switches: [
      { when: 'bus', dashboardId: BUS, routeIds: [AM_ROUTE] },
      { when: 'times', days: [1, 2, 3, 4, 5], from: '01:45', to: '02:45', dashboardId: HOME },
    ] } });
    expect(openRows()).toHaveLength(0);
    expect(document.querySelector('[data-switch-remove], [data-switch-up], [data-dashboard-open]')).toBeNull();
    unfold(rows()[0]!);
    expect(openRows()).toEqual([rows()[0]]);
    unfold(rows()[1]!);
    expect(openRows()).toEqual([rows()[1]]);
    press('Add a time');
    expect(openRows()).toEqual([rows()[2]]);
  });

  it('the strip draws a band per switch today in its row\'s swatch colour, night as shading, and now', async () => {
    await show({
      idle: { day: 'photos', night: 'photos', switch: { by: 'clock', from: '21:00', to: '06:30' } },
      plan: { dashboardId: null, switches: [
        { when: 'bus', dashboardId: BUS },
        { when: 'times', days: [0, 1, 2, 3, 4, 5, 6], from: '16:00', to: '18:00', dashboardId: HOME },
      ] },
    });
    const strip = document.querySelector('[data-day-strip]')!;
    // Monday: the bus at 7:15 and 3:00, the set time at 4:00.
    expect(Array.from(strip.querySelectorAll('[data-strip-band]')).map((b) => b.getAttribute('data-strip-band')).sort()).toEqual(['0', '0', '1']);
    for (const i of [0, 1]) {
      const swatch = rows()[i]!.querySelector('[data-swatch]')!.getAttribute('data-swatch');
      for (const band of strip.querySelectorAll(`[data-strip-band="${i}"]`)) expect(band.getAttribute('data-color')).toBe(swatch);
    }
    expect(strip.querySelectorAll('[data-strip-night]')).toHaveLength(2);
    expect(strip.querySelector('[data-strip-now]')).toBeTruthy();
    expect(strip.querySelector('[data-strip-caption]')!.textContent).toBe('Today. Shaded: night (21:00 to 06:30). Line: now.');
  });

  it('nothing about the schedule is sent until Done: every change stays on the editor page', async () => {
    await show();
    const sent = jest.fn(async () => ({ ok: true, json: async () => ({}) }));
    global.fetch = sent as never;
    press('Add a time');
    unfold(normally());
    pick('Normally', BUS);
    expect(sent).not.toHaveBeenCalled();
    expect(seen.plan).toMatchObject({ dashboardId: BUS });
  });
});

describe('a device nobody named (#1267, #1349)', () => {
  it('keeps its idle rows; Normally and Add a time ask for a name first, in place', async () => {
    await show({ screenId: null, plan: null, deviceNamed: false });
    expect(document.querySelector('[data-screen-scope]')!.textContent).toBe('Not named yet · This screen');
    expect(sentence()).toMatch(/^This screen shows Home\./);
    pick('By day it shows', 'sky');
    expect(seen.idle).toEqual({ source: 'sky' });
    expect(screen.getByLabelText('Idle after')).toBeTruthy();
    expect(document.querySelector('[data-name-first]')).toBeNull();
    await act(async () => { press('Add a time'); });
    expect(document.querySelector('[data-name-first] [data-name-device-form]')).toBeTruthy();
    expect(seen.plan).toBeNull();
  });

  it('Normally\'s Edit asks for the name in its row, and naming it opens it as that screen', async () => {
    await show({ screenId: null, plan: null, deviceNamed: false });
    await act(async () => { unfold(normally()); });
    const form = normally().querySelector<HTMLElement>('[data-name-device-form]')!;
    // A screen named before can be picked instead, after a browser reset.
    expect(within(form).getByRole('option', { name: 'Hall' })).toBeTruthy();
    fireEvent.change(within(form).getByLabelText('Name for this screen'), { target: { value: 'Den' } });
    await act(async () => { press('Name it'); });
    expect(posted).toEqual([{ name: 'Den' }]);
    expect(named).toHaveBeenCalledWith('den');
  });

  it('a screen being edited is not asked for a name', async () => {
    await show({ deviceNamed: false });
    press('Add a time');
    expect(document.querySelector('[data-name-first]')).toBeNull();
    expect(rows()).toHaveLength(1);
  });
});

describe('busWindowsInWords', () => {
  it('groups the windows by their days, in time order, once each', () => {
    const clock = (t: string) => t;
    expect(busWindowsInWords([
      { scheduledTime: '15:30', activeDays: [1, 2, 3, 4, 5] },
      { scheduledTime: '07:45', activeDays: [1, 2, 3, 4, 5] },
      { scheduledTime: '07:45', activeDays: [1, 2, 3, 4, 5] },
      { scheduledTime: '10:00', activeDays: [6] },
    ], clock)).toBe('Mon–Fri 07:15 to 08:00, 15:00 to 15:45; Sat 09:30 to 10:15');
  });
});

describe('simplest', () => {
  it('stores one background when day and night match on the default rule', () => {
    expect(simplest({ day: 'photos', night: 'photos', switch: DEFAULT_NIGHT })).toEqual({ source: 'photos' });
    const own = { day: 'photos' as const, night: 'photos' as const, switch: { by: 'clock' as const, from: '21:00', to: '06:30' } };
    expect(simplest(own)).toBe(own);
  });
});

describe('idleSaveProblem', () => {
  it('refuses a night that starts and ends at the same time, and crossed offsets', () => {
    expect(idleSaveProblem({ day: 'photos', night: 'sky', switch: { by: 'clock', from: '21:00', to: '21:00' } }, {})).toBe('Night must start and end at different times.');
    expect(idleSaveProblem({ day: 'photos', night: 'sky', switch: DEFAULT_NIGHT }, { crossed: new Date() })).toMatch(/^With these offsets/);
    expect(idleSaveProblem({ source: 'photos' }, {})).toBeNull();
  });
});
