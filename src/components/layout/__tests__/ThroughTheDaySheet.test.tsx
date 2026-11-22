/**
 * @jest-environment jsdom
 *
 * The Through the day sheet (#1152) as plain rows (#1281). For a screen: the
 * dashboard it shows and the dashboards it switches to at bus time or at set
 * times (#1282), a row each, kept on the editor page until Done. A device
 * nobody named is offered a name (#1267). Then the dashboard's own resting and
 * night: plain choices in a row, Photos and the night sky among them, saved
 * with the dashboard. Rest after and How dark are the screen's own, shown
 * only when the editor is for a screen. See it shows the canvas in use,
 * resting or at night. A dashboard nobody gave a night is stored as before.
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

const seen: { value?: IdleBackground; half?: IdleHalf; tab?: EditTab; plan?: ScreenPlan | null } = {};

function Harness({ initial, dashboards, plan = PLAIN, screenId = 'kitchen', forScreen = true, current = HOME, deviceNamed = true }: {
  initial: IdleBackground; dashboards?: typeof DASHBOARDS; plan?: ScreenPlan | null; screenId?: string | null; forScreen?: boolean; current?: string; deviceNamed?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [half, setHalf] = useState<IdleHalf>('day');
  const [tab, setTab] = useState<EditTab>('dashboard');
  const [screenPlan, setScreenPlan] = useState<ScreenPlan | null>(plan);
  React.useEffect(() => { seen.value = value; seen.half = half; seen.tab = tab; seen.plan = screenPlan; });
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
const seeIt = (name: string) => fireEvent.click(screen.getByRole('radiogroup', { name: 'See it' }).querySelector<HTMLElement>(`[data-see="${name}"]`)!);

describe('ThroughTheDaySheet', () => {
  describe('plain rows (#1281)', () => {
    it('has no lanes, line or slider: a row for resting, one for night, and See it', () => {
      render(<Harness initial={{ day: 'photos', night: 'sky', switch: { by: 'clock', from: '21:00', to: '06:30' } }} />);
      for (const gone of ['[data-day-lanes]', '[data-day-lane]', '[data-day-line]', '[data-day-milestone]', '[data-day-card]', '[data-day-slider]']) {
        expect(document.querySelector(gone)).toBeNull();
      }
      expect((screen.getByLabelText('While resting') as HTMLSelectElement).value).toBe('photos');
      expect((screen.getByLabelText('When night is') as HTMLSelectElement).value).toBe('clock');
      expect((screen.getByLabelText('Night look') as HTMLSelectElement).value).toBe('sky');
      expect(Array.from(screen.getByRole('radiogroup', { name: 'See it' }).querySelectorAll('[role="radio"]')).map((b) => b.textContent))
        .toEqual(['In use', 'Resting', 'Night']);
      // See it first, in reach without scrolling past the rows.
      expect(document.querySelector('[data-day-sheet]')!.firstElementChild!.hasAttribute('data-see-it')).toBe(true);
      // What the screen shows, the dashboard's rows, then the screen's own.
      expect(Array.from(document.querySelectorAll('[data-row-name]')).map((n) => n.textContent))
        .toEqual(['Shows', 'Resting', 'At night', 'Night is', 'Rest after', 'How dark']);
    });

    it('See it shows the canvas in use, resting or at night', () => {
      render(<Harness initial={{ source: 'photos' }} />);
      expect(document.querySelector('[data-day-sheet]')!.getAttribute('data-day-shows')).toBe('active');
      seeIt('night');
      expect(seen).toMatchObject({ tab: 'idle', half: 'night' });
      expect(document.querySelector('[data-see="night"]')!.getAttribute('aria-checked')).toBe('true');
      seeIt('resting');
      expect(seen).toMatchObject({ tab: 'idle', half: 'day' });
      seeIt('active');
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
      const looks = Array.from((screen.getByLabelText('Night look') as HTMLSelectElement).options).map((o) => o.textContent);
      expect(looks).toEqual(['Dim this dashboard', 'Night sky', 'Photos', 'Screen off']);
      pick('Night look', 'photos');
      expect(seen.value).toEqual({ day: 'sky', night: 'photos', switch: DEFAULT_NIGHT });
      expect(seen.half).toBe('night');
    });

    it('sets a night look that turns the screen off, on the default night', () => {
      render(<Harness initial={{ source: 'photos' }} />);
      pick('Night look', 'off');
      expect(seen.value).toEqual({ day: 'photos', night: 'off', switch: DEFAULT_NIGHT });
      expect(seen.half).toBe('night');
      // Nothing to dim on a screen that is off.
      expect(screen.queryByLabelText('How dark at night')).toBeNull();
    });

    it('turns dimming on when Dim this dashboard is chosen on a screen that does not dim', () => {
      render(<Harness initial={{ day: 'dashboard', night: 'sky', switch: DEFAULT_NIGHT }} />);
      pick('Night look', 'dashboard');
      expect(seen.value).toEqual({ source: 'dashboard' });
      expect(localStorage.getItem('prism-screensaver-dim')).toBe('0.5');
    });

    it('sets night by the clock instead of the sun', () => {
      render(<Harness initial={{ source: 'dashboard' }} />);
      pick('When night is', 'clock');
      expect(seen.half).toBe('night');
      fireEvent.change(screen.getByLabelText('Night starts'), { target: { value: '22:15' } });
      expect(seen.value).toEqual({ day: 'dashboard', night: 'dashboard', switch: { by: 'clock', from: '22:15', to: '06:30' } });
    });

    it('by the sun, says tonight\'s times and moves an end', () => {
      render(<Harness initial={{ source: 'dashboard' }} />);
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
      pick('Night look', 'dashboard');
      expect(seen.value).toEqual({ source: 'dashboard' });
      expect(localStorage.getItem('prism-screensaver-dim')).toBeNull();
    });
  });

  describe('a screen\'s dashboard and switches (#1282)', () => {
    beforeEach(() => {
      // Only the date is faked: a new switch starts at this quarter hour.
      jest.useFakeTimers({ now: new Date(2026, 10, 23, 7, 5), doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'queueMicrotask', 'nextTick'] });
      global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ routes: [
        { scheduledTime: '07:45', activeDays: [1, 2, 3, 4, 5] },
        { scheduledTime: '15:30', activeDays: [1, 2, 3, 4, 5] },
      ] }) })) as never;
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

    it('+ Switch at bus time adds one, says when from the bus routes, and is offered once', async () => {
      render(<Harness initial={{ source: 'dashboard' }} />);
      await act(async () => { press('Switch at bus time'); });
      expect(kept()).toEqual([{ when: 'bus', dashboardId: BUS }]);
      expect(rows()[0]!.querySelector('[data-row-name]')!.textContent).toBe('At bus time');
      expect(document.querySelector('[data-bus-windows]')!.textContent).toBe('Mon–Fri 07:15 to 08:00, 15:00 to 15:45');
      expect((screen.getByRole('button', { name: 'Switch at bus time' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('at bus time with no route set up, it says it never switches', async () => {
      global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ routes: [] }) })) as never;
      render(<Harness initial={{ source: 'dashboard' }} plan={{ dashboardId: null, switches: [{ when: 'bus', dashboardId: BUS }] }} />);
      await act(async () => {});
      expect(document.querySelector('[data-bus-windows]')!.textContent).toMatch(/^No bus route is set up yet/);
    });

    it('a set-times switch keeps at least one day', () => {
      render(<Harness initial={{ source: 'dashboard' }} plan={{ dashboardId: null, switches: [{ when: 'times', days: [1], from: '07:00', to: '08:00', dashboardId: BUS }] }} />);
      expect((rows()[0]!.querySelector<HTMLButtonElement>('[aria-label="Monday"]')!).disabled).toBe(true);
    });

    it('moves a switch up the order that decides an overlap', () => {
      render(<Harness initial={{ source: 'dashboard' }} plan={{ dashboardId: null, switches: [
        { when: 'times', days: [0, 1, 2, 3, 4, 5, 6], from: '07:00', to: '09:00', dashboardId: HOME },
        { when: 'bus', dashboardId: BUS },
      ] }} />);
      expect(screen.getByText('If two overlap, the higher one wins.')).toBeTruthy();
      expect(rows()[0]!.querySelector('[data-switch-up]')).toBeNull();
      fireEvent.click(rows()[1]!.querySelector<HTMLElement>('[data-switch-up]')!);
      expect(kept().map((sw) => sw.when)).toEqual(['bus', 'times']);
    });

    it('Shows is the dashboard the screen shows, and a switch\'s Open opens its dashboard', () => {
      render(<Harness initial={{ source: 'dashboard' }} plan={{ dashboardId: null, switches: [{ when: 'bus', dashboardId: BUS }] }} />);
      // None set: the default.
      expect((screen.getByLabelText('Dashboard this screen shows') as HTMLSelectElement).value).toBe(HOME);
      fireEvent.click(rows()[0]!.querySelector<HTMLElement>(`[data-dashboard-open="${BUS}"]`)!);
      expect(switched).toHaveBeenCalledWith('bus');
      pick('Dashboard this screen shows', BUS);
      expect(seen.plan!.dashboardId).toBe(BUS);
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
