/**
 * @jest-environment jsdom
 *
 * The Through the day sheet (#1152) as rows (#1281) that fold (#1294). First
 * a day slider that steps through the day's waypoints and shows the screen
 * then. For a screen: the dashboard it shows and the dashboards it switches to
 * at bus time or at set times (#1282), a row each, kept on the editor page
 * until Done. A device nobody named is offered a name (#1267). Then the
 * dashboard's own resting and night, saved with the dashboard: Resting with
 * See it, and At night as a row shaped like a switch. Each switch and At night
 * fold to one line, one open at a time. Rest after and How dark are the
 * screen's own, shown only when the editor is for a screen. A dashboard nobody
 * gave a night is stored as before.
 */
import React, { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { busWindowsInWords, simplest, ThroughTheDaySheet } from '../ThroughTheDaySheet';
import { idleSaveProblem } from '../IdleBackgroundBar';
import type { IdleBackground } from '@/lib/idleBackground';
import type { EditTab, IdleHalf } from '@/components/dashboard/useDashboardLayout';
import { DEFAULT_NIGHT } from '@/lib/throughTheDay';
import type { ScreenPlan } from '@/lib/screenSwitches';

jest.mock('@/components/providers/TimeFormatProvider', () => ({
  // The household's clock is the screen's, as on a real screen.
  useTimeFormat: () => ({ timeFormat: '24h', householdTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
}));
jest.mock('@/components/screensaver/useIdleBackground', () => ({
  useSkyLocation: () => ({ lat: 45, lon: -100 }),
}));
jest.mock('@/components/screensaver/ScreensaverQuickSettings', () => ({ ScreensaverSettingsPanel: () => null }));
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

const seen: { value?: IdleBackground; half?: IdleHalf; tab?: EditTab; plan?: ScreenPlan | null; preview?: string | null } = {};

function Harness({ initial, dashboards, plan = PLAIN, screenId = 'kitchen', forScreen = true, current = HOME, deviceNamed = true }: {
  initial: IdleBackground; dashboards?: typeof DASHBOARDS; plan?: ScreenPlan | null; screenId?: string | null; forScreen?: boolean; current?: string; deviceNamed?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [half, setHalf] = useState<IdleHalf>('day');
  const [tab, setTab] = useState<EditTab>('dashboard');
  const [screenPlan, setScreenPlan] = useState<ScreenPlan | null>(plan);
  const [preview, setPreview] = useState<string | null>(null);
  React.useEffect(() => { seen.value = value; seen.half = half; seen.tab = tab; seen.plan = screenPlan; seen.preview = preview; });
  return (
    <ThroughTheDaySheet
      idleBackground={value} onIdleBackgroundChange={setValue}
      idleHalf={half} onIdleHalfChange={setHalf}
      editTab={tab} onEditTabChange={setTab}
      idleCheck={{}}
      allDashboards={(dashboards ?? DASHBOARDS) as never}
      currentDashboardId={current}
      onSwitchDashboard={switched}
      screenPlan={screenPlan}
      onScreenPlanChange={setScreenPlan}
      screenId={screenId}
      forScreen={forScreen}
      deviceNamed={deviceNamed}
      onDeviceNamed={named}
      previewDashboardId={preview}
      onPreviewDashboardChange={setPreview}
    />
  );
}
const named = jest.fn();
const switched = jest.fn();

afterEach(() => { localStorage.clear(); switched.mockReset(); named.mockReset(); });

/** The switches the editor page holds now. */
const kept = () => seen.plan!.switches;
const rows = () => Array.from(document.querySelectorAll<HTMLElement>('[data-switch-row]'));
const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const pick = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const seeResting = () => fireEvent.click(document.querySelector<HTMLElement>('[data-see="resting"]')!);
/** Opens a folded row by its toggle. */
const unfold = (row: Element) => fireEvent.click(row.querySelector<HTMLElement>('[data-fold-toggle]')!);
const nightRow = () => document.querySelector<HTMLElement>('[data-night-row]')!;
const openNight = () => { if (nightRow().getAttribute('data-open') !== 'true') unfold(nightRow()); };
const openRows = () => Array.from(document.querySelectorAll('[data-open="true"]'));
const summary = (row: Element) => row.querySelector('[data-fold-summary]')!.textContent;

describe('ThroughTheDaySheet', () => {
  describe('plain rows (#1281)', () => {
    it('the slider first, then a row for resting with See it and a folded one for night', () => {
      render(<Harness initial={{ day: 'photos', night: 'sky', switch: { by: 'clock', from: '21:00', to: '06:30' } }} />);
      // The See it strip went: the slider shows in use and night (#1294).
      expect(document.querySelector('[data-see-it]')).toBeNull();
      expect(document.querySelector('[data-day-sheet]')!.firstElementChild!.querySelector('[data-day-slider]')).toBeTruthy();
      expect((screen.getByLabelText('While resting') as HTMLSelectElement).value).toBe('photos');
      // What the screen shows, the dashboard's rows, then the screen's own.
      expect(Array.from(document.querySelectorAll('[data-row-name]')).map((n) => n.textContent))
        .toEqual(['Shows', 'Resting', 'At night', 'Rest after', 'How dark']);
      // Night folds to one line that says what it does.
      expect(openRows()).toHaveLength(0);
      expect(screen.queryByLabelText('Night look')).toBeNull();
      expect(summary(nightRow())).toBe('Night sky · 21:00–06:30');
      openNight();
      expect((screen.getByLabelText('When night is') as HTMLSelectElement).value).toBe('clock');
      expect((screen.getByLabelText('Night look') as HTMLSelectElement).value).toBe('sky');
    });

    it('Resting\'s See it shows the canvas resting, and Back to in use brings it back', () => {
      render(<Harness initial={{ source: 'photos' }} />);
      expect(document.querySelector('[data-day-sheet]')!.getAttribute('data-day-shows')).toBe('active');
      expect(document.querySelector('[data-day-back]')).toBeNull();
      seeResting();
      expect(seen).toMatchObject({ tab: 'idle', half: 'day' });
      expect(document.querySelector('[data-see="resting"]')!.getAttribute('aria-pressed')).toBe('true');
      fireEvent.click(document.querySelector<HTMLElement>('[data-day-back]')!);
      expect(seen.tab).toBe('dashboard');
      expect(document.querySelector('[data-day-sheet]')!.getAttribute('data-day-shows')).toBe('active');
    });

    it('picks what it shows resting, and shows it', () => {
      render(<Harness initial={{ day: 'photos', night: 'sky', switch: { by: 'clock', from: '21:00', to: '06:30' } }} />);
      pick('While resting', 'sky');
      expect(seen.value).toMatchObject({ day: 'sky' });
      expect(seen).toMatchObject({ tab: 'idle', half: 'day' });
    });

    it('Photos at night is one of the night choices, beside the night sky', () => {
      render(<Harness initial={{ source: 'sky' }} />);
      openNight();
      const looks = Array.from((screen.getByLabelText('Night look') as HTMLSelectElement).options).map((o) => o.textContent);
      expect(looks).toEqual(['Dim this dashboard', 'Night sky', 'Photos', 'Screen off']);
      pick('Night look', 'photos');
      expect(seen.value).toEqual({ day: 'sky', night: 'photos', switch: DEFAULT_NIGHT });
      expect(seen.half).toBe('night');
    });

    it('sets a night look that turns the screen off, on the default night', () => {
      render(<Harness initial={{ source: 'photos' }} />);
      openNight();
      pick('Night look', 'off');
      expect(seen.value).toEqual({ day: 'photos', night: 'off', switch: DEFAULT_NIGHT });
      expect(seen.half).toBe('night');
      // Nothing to dim on a screen that is off.
      expect(screen.queryByLabelText('How dark at night')).toBeNull();
    });

    it('turns dimming on when Dim this dashboard is chosen on a screen that does not dim', () => {
      render(<Harness initial={{ day: 'dashboard', night: 'sky', switch: DEFAULT_NIGHT }} />);
      openNight();
      pick('Night look', 'dashboard');
      expect(seen.value).toEqual({ source: 'dashboard' });
      expect(localStorage.getItem('prism-screensaver-dim')).toBe('0.5');
    });

    it('sets night by the clock instead of the sun', () => {
      render(<Harness initial={{ source: 'dashboard' }} />);
      openNight();
      pick('When night is', 'clock');
      expect(seen.half).toBe('night');
      fireEvent.change(screen.getByLabelText('Night starts'), { target: { value: '22:15' } });
      expect(seen.value).toEqual({ day: 'dashboard', night: 'dashboard', switch: { by: 'clock', from: '22:15', to: '06:30' } });
    });

    it('by the sun, says tonight\'s times and moves an end', () => {
      render(<Harness initial={{ source: 'dashboard' }} />);
      expect(summary(nightRow())).toMatch(/^Dim this dashboard · dusk to dawn, tonight \d\d:\d\d–\d\d:\d\d$/);
      openNight();
      expect(document.querySelector('[data-night-times]')!.textContent).toMatch(/^Tonight \d\d:\d\d to \d\d:\d\d\.$/);
      fireEvent.change(screen.getByLabelText('Ends: unit'), { target: { value: 'hr' } });
      fireEvent.change(screen.getByLabelText('Ends: amount'), { target: { value: '1' } });
      expect(seen.value).toEqual({ day: 'dashboard', night: 'dashboard', switch: { by: 'sun', duskOffset: 30, dawnOffset: -60 } });
    });

    it('says the look is the dashboard\'s, for every screen showing it', () => {
      render(<Harness initial={{ source: 'photos' }} current={BUS} />);
      expect(document.querySelector('[data-day-shared]')!.textContent).toMatch(/^Every screen showing Bus rests and sleeps this way\./);
    });

    it('for a screen, Rest after and How dark are its own', () => {
      render(<Harness initial={{ source: 'photos' }} />);
      fireEvent.change(screen.getByLabelText('Rest after'), { target: { value: '3600' } });
      expect(localStorage.getItem('prism-screensaver-timeout')).toBe('3600');
      fireEvent.change(screen.getByLabelText('How dark at night'), { target: { value: '0.75' } });
      expect(localStorage.getItem('prism-screensaver-dim')).toBe('0.75');
    });

    it('for a dashboard alone, there is no screen to rest or dim, and nothing changes one', () => {
      render(<Harness initial={{ day: 'dashboard', night: 'sky', switch: DEFAULT_NIGHT }} forScreen={false} screenId={null} />);
      expect(screen.queryByLabelText('Rest after')).toBeNull();
      expect(screen.queryByLabelText('How dark at night')).toBeNull();
      openNight();
      pick('Night look', 'dashboard');
      expect(seen.value).toEqual({ source: 'dashboard' });
      expect(localStorage.getItem('prism-screensaver-dim')).toBeNull();
    });
  });

  describe('a screen\'s dashboard and switches (#1282)', () => {
    beforeEach(() => {
      // Only the date is faked: a new switch starts at this quarter hour.
      jest.useFakeTimers({ now: new Date(2026, 10, 23, 7, 5), doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'queueMicrotask', 'nextTick'] });
      global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ routes: ROUTES }) })) as never;
    });
    afterEach(() => jest.useRealTimers());

    it('+ Switch at set times adds a row on every day from this quarter hour, and its days and hours change in it', () => {
      render(<Harness initial={{ source: 'dashboard' }} />);
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
      render(<Harness initial={{ source: 'dashboard' }} />);
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

    it('a bus switch follows the routes picked on its row, and every route again with all of them on (#1291)', async () => {
      render(<Harness initial={{ source: 'dashboard' }} plan={{ dashboardId: null, switches: [{ when: 'bus', dashboardId: BUS }] }} />);
      await act(async () => {});
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
      render(<Harness initial={{ source: 'dashboard' }} plan={{ dashboardId: null, switches: [{ when: 'bus', dashboardId: BUS }] }} />);
      await act(async () => {});
      unfold(busRow());
      expect((screen.getByLabelText('Minutes before the bus') as HTMLSelectElement).value).toBe('30');
      expect((screen.getByLabelText('Minutes after the bus') as HTMLSelectElement).value).toBe('15');
      pick('Minutes before the bus', '10');
      pick('Minutes after the bus', '5');
      expect(kept()).toEqual([{ when: 'bus', dashboardId: BUS, before: 10, after: 5 }]);
      expect(windows()).toBe('Mon–Fri 07:35 to 07:50, 15:20 to 15:35');
    });

    it('with one bus route there is no route to pick (#1291)', async () => {
      global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ routes: ROUTES.slice(0, 1) }) })) as never;
      render(<Harness initial={{ source: 'dashboard' }} plan={{ dashboardId: null, switches: [{ when: 'bus', dashboardId: BUS }] }} />);
      await act(async () => {});
      unfold(busRow());
      expect(busRow().querySelector('[data-bus-routes]')).toBeNull();
      expect(windows()).toBe('Mon–Fri 07:15 to 08:00');
    });

    it('at bus time with no route set up, it says it never switches', async () => {
      global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ routes: [] }) })) as never;
      render(<Harness initial={{ source: 'dashboard' }} plan={{ dashboardId: null, switches: [{ when: 'bus', dashboardId: BUS }] }} />);
      await act(async () => {});
      expect(summary(busRow())).toBe('No bus route set up yet · Bus');
      unfold(busRow());
      expect(document.querySelector('[data-bus-windows]')!.textContent).toMatch(/^No bus route is set up yet/);
    });

    it('a set-times switch keeps at least one day', () => {
      render(<Harness initial={{ source: 'dashboard' }} plan={{ dashboardId: null, switches: [{ when: 'times', days: [1], from: '07:00', to: '08:00', dashboardId: BUS }] }} />);
      unfold(rows()[0]!);
      expect((rows()[0]!.querySelector<HTMLButtonElement>('[aria-label="Monday"]')!).disabled).toBe(true);
    });

    it('moves a switch up the order that decides an overlap', () => {
      render(<Harness initial={{ source: 'dashboard' }} plan={{ dashboardId: null, switches: [
        { when: 'times', days: [0, 1, 2, 3, 4, 5, 6], from: '07:00', to: '09:00', dashboardId: HOME },
        { when: 'bus', dashboardId: BUS },
      ] }} />);
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

    it('Shows is the dashboard the screen shows, and a switch\'s Open opens its dashboard', () => {
      render(<Harness initial={{ source: 'dashboard' }} plan={{ dashboardId: null, switches: [{ when: 'bus', dashboardId: BUS }] }} />);
      // None set: the default.
      expect((screen.getByLabelText('Dashboard this screen shows') as HTMLSelectElement).value).toBe(HOME);
      unfold(rows()[0]!);
      fireEvent.click(rows()[0]!.querySelector<HTMLElement>(`[data-dashboard-open="${BUS}"]`)!);
      expect(switched).toHaveBeenCalledWith('bus');
      pick('Dashboard this screen shows', BUS);
      expect(seen.plan!.dashboardId).toBe(BUS);
    });

    it('each switch folds to one line that says what it does, and one row opens at a time (#1294)', async () => {
      render(<Harness initial={{ day: 'photos', night: 'sky', switch: { by: 'clock', from: '21:00', to: '06:30' } }} plan={{ dashboardId: null, switches: [
        { when: 'bus', dashboardId: BUS, routeIds: [AM_ROUTE] },
        { when: 'times', days: [1, 2, 3, 4, 5], from: '01:45', to: '02:45', dashboardId: HOME },
      ] }} />);
      await act(async () => {});
      // All folded when the editor opens, Open, up and Remove inside.
      expect(openRows()).toHaveLength(0);
      expect(document.querySelector('[data-switch-remove], [data-switch-up], [data-dashboard-open]')).toBeNull();
      expect(rows().map(summary)).toEqual(['Morning 07:15–08:00 · Bus', 'Mon–Fri 01:45–02:45 · Home']);
      unfold(rows()[0]!);
      expect(openRows()).toEqual([rows()[0]]);
      expect(rows()[0]!.querySelector('[data-switch-remove]')).toBeTruthy();
      // Opening another folds the one that was open.
      unfold(rows()[1]!);
      expect(openRows()).toEqual([rows()[1]]);
      openNight();
      expect(openRows()).toEqual([nightRow()]);
      // A tap on the open one folds it.
      unfold(nightRow());
      expect(openRows()).toHaveLength(0);
    });

    it('a switch just added opens, and the one that was open folds (#1294)', () => {
      render(<Harness initial={{ source: 'dashboard' }} plan={{ dashboardId: null, switches: [{ when: 'times', days: [1], from: '07:00', to: '08:00', dashboardId: BUS }] }} />);
      unfold(rows()[0]!);
      press('Switch at set times');
      expect(rows()).toHaveLength(2);
      expect(openRows()).toEqual([rows()[1]]);
      expect(rows()[1]!.querySelector('[aria-label="Switch starts"]')).toBeTruthy();
    });

    it('nothing is sent until Done: every change stays on the editor page', () => {
      const sent = jest.fn(async () => ({ ok: true, json: async () => ({}) }));
      global.fetch = sent as never;
      render(<Harness initial={{ source: 'dashboard' }} />);
      press('Switch at set times');
      pick('Dashboard this screen shows', BUS);
      expect(sent).not.toHaveBeenCalled();
      expect(seen.plan).toMatchObject({ dashboardId: BUS });
    });

    it('a dashboard edited on its own has no screen, so nothing to show or switch', () => {
      render(<Harness initial={{ source: 'dashboard' }} screenId={null} forScreen={false} />);
      expect(document.querySelector('[data-screen-plan]')).toBeNull();
      expect(document.querySelector('[data-switch-add]')).toBeNull();
      expect(screen.queryByLabelText('Dashboard this screen shows')).toBeNull();
      // No timeline either: those are gone (#1282).
      expect(document.querySelector('[data-timeline-bar]')).toBeNull();
    });
  });

  describe('the day slider (#1294)', () => {
    const AMBIENT = '55555555-5555-4555-8555-555555555555';
    const THREE = [...DASHBOARDS, { id: AMBIENT, name: 'Ambient', slug: 'ambient', isDefault: false }];
    /** Home's night from 9 pm to 6:30 am; Bus at bus time, Ambient from 1:45 to 2:45 every day. */
    const NIGHT: IdleBackground = { day: 'photos', night: 'sky', switch: { by: 'clock', from: '21:00', to: '06:30' } };
    const PLAN: ScreenPlan = { dashboardId: null, switches: [
      { when: 'bus', dashboardId: BUS },
      { when: 'times', days: [0, 1, 2, 3, 4, 5, 6], from: '01:45', to: '02:45', dashboardId: AMBIENT },
    ] };
    beforeEach(() => {
      // A Monday at 10 am, on the household's clock (the screen's here).
      jest.useFakeTimers({ now: new Date(2026, 10, 23, 10, 0), doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'queueMicrotask', 'nextTick'] });
      global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ routes: ROUTES }) })) as never;
    });
    afterEach(() => jest.useRealTimers());

    const dots = () => Array.from(document.querySelectorAll<HTMLElement>('[data-waypoint]'));
    const dotAt = (hhmm: string) => document.querySelector<HTMLElement>(`[data-waypoint][data-minute="${Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3))}"]`)!;
    const label = () => document.querySelector('[data-day-label]')!.textContent;
    const caption = () => document.querySelector('[data-day-caption]')?.textContent ?? null;
    const later = () => fireEvent.click(screen.getByRole('button', { name: 'Later' }));
    const earlier = () => fireEvent.click(screen.getByRole('button', { name: 'Earlier' }));

    it('a dot wherever the screen changes today: night, each switch\'s start and end, and now', async () => {
      render(<Harness initial={NIGHT} plan={PLAN} dashboards={THREE as never} />);
      await act(async () => {});
      expect(dots().map((d) => `${d.getAttribute('data-minute')} ${d.getAttribute('data-waypoint-marks')}`)).toEqual([
        '105 switch-start1', '165 switch-end1', '390 night-end', '435 switch-start0', '480 switch-end0',
        '600 now', '900 switch-start0', '945 switch-end0', '1260 night-start',
      ]);
      expect(dotAt('21:00').getAttribute('aria-label')).toBe('21:00, night starts');
      expect(dotAt('07:15').getAttribute('aria-label')).toBe('07:15, Bus starts');
      // Nothing picked yet: the canvas is as it was.
      expect(label()).toBe('Step through the day to see the screen then.');
      expect(seen).toMatchObject({ tab: 'dashboard', preview: null });
    });

    it('◀ ▶ step from now, and the canvas shows the screen at each stop', async () => {
      render(<Harness initial={NIGHT} plan={PLAN} dashboards={THREE as never} />);
      await act(async () => {});
      later();
      expect(label()).toBe('15:00, Bus starts');
      // A switch's dashboard, as it is saved.
      expect(caption()).toBe('Shows Bus as it is saved');
      expect(seen).toMatchObject({ tab: 'dashboard', preview: BUS });
      later();
      expect(label()).toBe('15:45, Bus ends');
      expect(caption()).toBe('Shows Home in use');
      expect(seen).toMatchObject({ tab: 'dashboard', preview: null });
      later();
      // Night: the night look.
      expect(label()).toBe('21:00, night starts');
      expect(caption()).toBe('Shows Home at night');
      expect(seen).toMatchObject({ tab: 'idle', half: 'night', preview: null });
      expect(document.querySelector('[data-day-sheet]')!.getAttribute('data-day-at')).toBe('1260');
      expect((screen.getByRole('button', { name: 'Later' }) as HTMLButtonElement).disabled).toBe(true);
      for (let n = 0; n < 4; n++) earlier();
      expect(label()).toBe('08:00, Bus ends');
      earlier();
      expect(label()).toBe('07:15, Bus starts');
      earlier();
      // Night ends: Home in use again, not the night look.
      expect(label()).toBe('06:30, night ends');
      expect(seen).toMatchObject({ tab: 'dashboard', preview: null });
      earlier();
      // A switch at night shows its dashboard.
      expect(label()).toBe('02:45, Ambient ends');
      expect(seen).toMatchObject({ tab: 'idle', half: 'night' });
      earlier();
      expect(label()).toBe('01:45, Ambient starts');
      expect(seen).toMatchObject({ tab: 'dashboard', preview: AMBIENT });
      expect((screen.getByRole('button', { name: 'Earlier' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('tapping a dot goes there and opens the row that makes it; the line itself sets nothing', async () => {
      render(<Harness initial={NIGHT} plan={PLAN} dashboards={THREE as never} />);
      await act(async () => {});
      fireEvent.click(dotAt('01:45'));
      expect(seen.preview).toBe(AMBIENT);
      expect(openRows()).toEqual([rows()[1]]);
      fireEvent.click(dotAt('06:30'));
      expect(openRows()).toEqual([nightRow()]);
      fireEvent.click(dotAt('10:00'));
      expect(label()).toBe('Now, 10:00');
      // Nothing on the line is a setting.
      expect(seen.plan).toEqual(PLAN);
      expect(seen.value).toEqual(NIGHT);
      expect(document.querySelector('[data-day-slider] select, [data-day-slider] input')).toBeNull();
    });

    it('each switch has a colour of its own, the same on its row as on its stretches and dots of the line', async () => {
      render(<Harness initial={NIGHT} plan={PLAN} dashboards={THREE as never} />);
      await act(async () => {});
      const rowColor = (row: Element) => row.querySelector('[data-swatch]')!.getAttribute('data-swatch');
      const [bus, times] = rows().map(rowColor);
      expect(bus).not.toBe(times);
      // The bus switch's two windows, and Ambient's one, in their row's colour.
      expect(Array.from(document.querySelectorAll('[data-day-span="0"]')).map((el) => el.getAttribute('data-color'))).toEqual([bus, bus]);
      expect(Array.from(document.querySelectorAll('[data-day-span="1"]')).map((el) => el.getAttribute('data-color'))).toEqual([times]);
      const dotColor = (hhmm: string) => document.querySelector(`[data-waypoint-dot="${Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3))}"]`)!.getAttribute('data-color');
      expect([dotColor('07:15'), dotColor('08:00'), dotColor('15:00')]).toEqual([bus, bus, bus]);
      expect([dotColor('01:45'), dotColor('02:45')]).toEqual([times, times]);
      // Night too, and now has none.
      const night = rowColor(nightRow());
      expect(night).not.toBe(bus);
      expect([dotColor('06:30'), dotColor('21:00')]).toEqual([night, night]);
      expect(Array.from(document.querySelectorAll('[data-day-night]')).every((el) => el.getAttribute('data-color') === night)).toBe(true);
      expect(dotColor('10:00')).toBeNull();
    });

    it('the stop picked shows only while the canvas shows its moment', async () => {
      render(<Harness initial={NIGHT} plan={PLAN} dashboards={THREE as never} />);
      await act(async () => {});
      later();
      expect(caption()).toBe('Shows Bus as it is saved');
      seeResting();
      expect(seen).toMatchObject({ tab: 'idle', half: 'day', preview: null });
      expect(label()).toBe('Step through the day to see the screen then.');
      expect(document.querySelector('[data-day-sheet]')!.hasAttribute('data-day-at')).toBe(false);
      fireEvent.click(document.querySelector<HTMLElement>('[data-day-back]')!);
      expect(seen).toMatchObject({ tab: 'dashboard', preview: null });
    });

    it('a dashboard edited on its own shows only night\'s start and end, and its own night', async () => {
      // Bus, not the household's default, is being edited.
      render(<Harness initial={NIGHT} plan={null} screenId={null} forScreen={false} current={BUS} />);
      await act(async () => {});
      expect(dots().map((d) => d.getAttribute('data-waypoint-marks'))).toEqual(['night-end', 'now', 'night-start']);
      later();
      expect(label()).toBe('21:00, night starts');
      expect(caption()).toBe('Shows Bus at night');
      expect(seen).toMatchObject({ tab: 'idle', half: 'night', preview: null });
      earlier();
      expect(seen).toMatchObject({ tab: 'dashboard', preview: null });
    });
  });

  describe('naming the device in use (#1267)', () => {
    let posted: unknown[] = [];
    beforeEach(() => {
      posted = [];
      global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          posted.push(JSON.parse(String(init.body)));
          return { ok: true, json: async () => ({ display: { id: 'den', name: 'Den' } }) };
        }
        if (url === '/api/displays') return { ok: true, json: async () => ({ displays: [{ id: 'hall', name: 'Hall' }] }) };
        return { ok: true, json: async () => ({}) };
      }) as never;
    });

    it('a device with no name is named here, and then opens as that screen', async () => {
      render(<Harness initial={{ source: 'dashboard' }} screenId={null} forScreen={false} deviceNamed={false} />);
      expect(screen.getByText(/^This device has no name, so it shows Home\./)).toBeTruthy();
      await act(async () => { press('Name this device'); });
      // A screen named before can be picked instead, after a browser reset.
      expect(screen.getByRole('option', { name: 'Hall' })).toBeTruthy();
      fireEvent.change(screen.getByLabelText('Name for this screen'), { target: { value: 'Den' } });
      await act(async () => { press('Name it'); });
      expect(posted).toEqual([{ name: 'Den' }]);
      expect(named).toHaveBeenCalledWith('den');
    });

    it('becomes a screen named before, taking its name', async () => {
      render(<Harness initial={{ source: 'dashboard' }} screenId={null} forScreen={false} deviceNamed={false} />);
      await act(async () => { press('Name this device'); });
      fireEvent.change(screen.getByLabelText('Existing screen'), { target: { value: 'hall' } });
      await act(async () => { press('Use its name and settings'); });
      expect(posted).toEqual([{ id: 'hall' }]);
      // And opens as that screen, which loads its settings afresh.
      expect(named).toHaveBeenCalledWith('den');
    });

    it('a device with a name, or a screen being edited, is not offered one', () => {
      const { unmount } = render(<Harness initial={{ source: 'dashboard' }} screenId={null} forScreen={false} />);
      expect(screen.queryByRole('button', { name: 'Name this device' })).toBeNull();
      unmount();
      render(<Harness initial={{ source: 'dashboard' }} deviceNamed={false} />);
      expect(screen.queryByRole('button', { name: 'Name this device' })).toBeNull();
    });
  });
});

describe('busWindowsInWords', () => {
  it('groups the windows by their days, in time order, once each', () => {
    expect(busWindowsInWords([
      { scheduledTime: '15:30', activeDays: [1, 2, 3, 4, 5] },
      { scheduledTime: '07:45', activeDays: [1, 2, 3, 4, 5] },
      { scheduledTime: '07:45', activeDays: [1, 2, 3, 4, 5] },
      { scheduledTime: '09:00', activeDays: [6] },
    ], (t) => t)).toBe('Mon–Fri 07:15 to 08:00, 15:00 to 15:45; Sat 08:30 to 09:15');
  });
});

describe('simplest', () => {
  it('stores one background when day and night match on the default rule', () => {
    expect(simplest({ day: 'photos', night: 'photos', switch: DEFAULT_NIGHT })).toEqual({ source: 'photos' });
    const own = { day: 'photos' as const, night: 'photos' as const, switch: { by: 'sun' as const, duskOffset: 0, dawnOffset: 0 } };
    expect(simplest(own)).toBe(own);
  });
});

describe('idleSaveProblem', () => {
  it('refuses a night that starts and ends at the same time, and crossed offsets', () => {
    expect(idleSaveProblem({ day: 'dashboard', night: 'sky', switch: { by: 'clock', from: '21:00', to: '21:00' } }, {})).toMatch(/different times/);
    expect(idleSaveProblem({ source: 'dashboard' }, { crossed: new Date() })).toBeNull();
    expect(idleSaveProblem({ day: 'dashboard', night: 'sky', switch: DEFAULT_NIGHT }, { crossed: new Date() })).toMatch(/offsets/);
  });
});
