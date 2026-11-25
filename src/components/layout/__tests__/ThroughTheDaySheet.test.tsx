/**
 * @jest-environment jsdom
 *
 * The Through the day sheet (#1152) as rows (#1281) that fold (#1294). First
 * a day slider that steps through the day's waypoints and shows the screen
 * then, with a dot for each of the screen's switches; tapping one opens it on
 * the Screen sheet, where the switches are set (#1326). Then the screen's
 * own idle look and night (#1345), saved to the screen: Resting, and At
 * night as a row shaped like a switch, folded to one line. A day
 * nobody gave a night is stored as before.
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

function Harness({ initial, dashboards, plan = PLAIN, screenId = 'kitchen', current = HOME }: {
  initial: IdleBackground; dashboards?: typeof DASHBOARDS; plan?: ScreenPlan | null; screenId?: string | null; current?: string;
}) {
  const [value, setValue] = useState(initial);
  const [half, setHalf] = useState<IdleHalf>('day');
  const [tab, setTab] = useState<EditTab>('dashboard');
  const [screenPlan] = useState<ScreenPlan | null>(plan);
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
      screenPlan={screenPlan}
      screenId={screenId}
      previewDashboardId={preview}
      onPreviewDashboardChange={setPreview}
      onOpenLook={lookOpened}
      onOpenSwitch={switchOpened}
    />
  );
}
const lookOpened = jest.fn();
const switchOpened = jest.fn();

afterEach(() => { localStorage.clear(); lookOpened.mockReset(); switchOpened.mockReset(); });

const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const pick = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const pickResting = (value: string) => fireEvent.change(screen.getByLabelText('While resting'), { target: { value } });
/** Opens a folded row by its toggle. */
const unfold = (row: Element) => fireEvent.click(row.querySelector<HTMLElement>('[data-fold-toggle]')!);
const nightRow = () => document.querySelector<HTMLElement>('[data-night-row]')!;
const openNight = () => { if (nightRow().getAttribute('data-open') !== 'true') unfold(nightRow()); };
const openRows = () => Array.from(document.querySelectorAll('[data-open="true"]'));
const summary = (row: Element) => row.querySelector('[data-fold-summary]')!.textContent;

describe('ThroughTheDaySheet', () => {
  describe('plain rows (#1281)', () => {
    it('the slider first, then a row for resting and a folded one for night', () => {
      render(<Harness initial={{ day: 'photos', night: 'sky', switch: { by: 'clock', from: '21:00', to: '06:30' } }} />);
      // The See it strip went: the slider shows in use and night (#1294).
      expect(document.querySelector('[data-see-it]')).toBeNull();
      expect(document.querySelector('[data-day-sheet]')!.firstElementChild!.querySelector('[data-day-slider]')).toBeTruthy();
      expect((screen.getByLabelText('While resting') as HTMLSelectElement).value).toBe('photos');
      // Only the dashboard's own rows: what the screen shows, its switches,
      // Rest after and How dark are on the Screen sheet (#1326).
      expect(Array.from(document.querySelectorAll('[data-row-name]')).map((n) => n.textContent))
        .toEqual(['Resting', 'At night']);
      // Night folds to one line that says what it does.
      expect(openRows()).toHaveLength(0);
      expect(screen.queryByLabelText('Night look')).toBeNull();
      expect(summary(nightRow())).toBe('Night sky · 21:00–06:30');
      openNight();
      expect((screen.getByLabelText('When night is') as HTMLSelectElement).value).toBe('clock');
      expect((screen.getByLabelText('Night look') as HTMLSelectElement).value).toBe('sky');
    });

    it('has no See it or Back to in use: the canvas\'s own toggles say what it draws (#1348)', () => {
      render(<Harness initial={{ source: 'photos' }} />);
      expect(document.querySelector('[data-day-sheet]')!.getAttribute('data-day-shows')).toBe('active');
      expect(document.querySelector('[data-see="resting"]')).toBeNull();
      expect(document.querySelector('[data-day-back]')).toBeNull();
      expect(screen.queryByRole('button', { name: 'See it' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Back to in use' })).toBeNull();
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
    });

    it('choosing the dashboard at night sets only the look, never how much darker (#1345)', () => {
      render(<Harness initial={{ day: 'dashboard', night: 'sky', switch: DEFAULT_NIGHT }} />);
      openNight();
      pick('Night look', 'dashboard');
      expect(seen.value).toEqual({ source: 'dashboard' });
      // No screen setting is written as a side effect of the look.
      expect(localStorage.getItem('prism-screensaver-dim')).toBeNull();
      expect(localStorage.getItem('prism-screen-day')).toBeNull();
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

    it('says the look is the screen\'s, whichever dashboard is up (#1345)', () => {
      render(<Harness initial={{ source: 'photos' }} current={BUS} />);
      expect(document.querySelector('[data-day-shared]')!.textContent)
        .toBe('This is the screen\'s own: it idles this way whichever dashboard is up. Done saves it to this screen.');
    });

    it('More\'s Screen fit and performance opens the editor\'s Look, not a Settings page (#1313)', () => {
      render(<Harness initial={{ source: 'photos' }} />);
      fireEvent.click(document.querySelector<HTMLElement>('[data-day-more]')!);
      // No link out of the editor.
      expect(document.querySelector('a[href*="/settings"]')).toBeNull();
      press('Screen fit and performance');
      expect(lookOpened).toHaveBeenCalledTimes(1);
    });
  });

  describe('a screen\'s switches are on the Screen sheet (#1326)', () => {
    beforeEach(() => {
      // A Monday at 10 am on the screen's own clock, in any time zone, so both
      // switches (weekday bus routes, and set times every day) are on today's line.
      jest.useFakeTimers({ now: new Date(2026, 10, 23, 10, 0), doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'queueMicrotask', 'nextTick'] });
      global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ routes: ROUTES }) })) as never;
    });
    afterEach(() => jest.useRealTimers());

    it('Through the day holds none of the screen\'s controls: what it shows, its switches, Rest after, How dark, naming', async () => {
      render(<Harness initial={{ day: 'dashboard', night: 'sky', switch: DEFAULT_NIGHT }} plan={{ dashboardId: BUS, switches: [
        { when: 'bus', dashboardId: BUS },
        { when: 'times', days: [0, 1, 2, 3, 4, 5, 6], from: '07:00', to: '08:00', dashboardId: HOME },
      ] }} />);
      await act(async () => {});
      expect(document.querySelector('[data-screen-plan], [data-switch-add], [data-switch-row], [data-screen-dashboard], [data-name-device]')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Switch at set times' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Switch at bus time' })).toBeNull();
      expect(screen.queryByLabelText('Base dashboard')).toBeNull();
      expect(screen.queryByLabelText('Rest after')).toBeNull();
      expect(screen.queryByLabelText('How dark at night')).toBeNull();
      // Its switches still show on the day's line.
      expect(document.querySelectorAll('[data-day-span="0"]').length).toBeGreaterThan(0);
      expect(document.querySelectorAll('[data-day-span="1"]').length).toBeGreaterThan(0);
    });

    it('a dashboard edited on its own has no screen, so nothing switches on its line', () => {
      render(<Harness initial={{ source: 'dashboard' }} screenId={null} />);
      expect(document.querySelector('[data-day-span]')).toBeNull();
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
      // Night ends: Home in use again by day, not the night look.
      expect(label()).toBe('06:30, night ends');
      expect(seen).toMatchObject({ tab: 'dashboard', half: 'day', preview: null });
      earlier();
      // A switch at night shows its dashboard.
      expect(label()).toBe('02:45, Ambient ends');
      expect(seen).toMatchObject({ tab: 'idle', half: 'night' });
      earlier();
      expect(label()).toBe('01:45, Ambient starts');
      // In use, and at night: the canvas's Night is the line's (#1348).
      expect(seen).toMatchObject({ tab: 'dashboard', half: 'night', preview: AMBIENT });
      expect((screen.getByRole('button', { name: 'Earlier' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('tapping a dot goes there and opens the row that makes it, a switch\'s on the Screen sheet; the line itself sets nothing', async () => {
      render(<Harness initial={NIGHT} plan={PLAN} dashboards={THREE as never} />);
      await act(async () => {});
      fireEvent.click(dotAt('01:45'));
      expect(seen.preview).toBe(AMBIENT);
      // Ambient's switch is the second: the Screen sheet opens at it (#1326).
      expect(switchOpened).toHaveBeenCalledWith(1);
      expect(openRows()).toHaveLength(0);
      fireEvent.click(dotAt('07:15'));
      expect(switchOpened).toHaveBeenLastCalledWith(0);
      // Stepping there with the arrows opens nothing.
      switchOpened.mockReset();
      later();
      expect(switchOpened).not.toHaveBeenCalled();
      fireEvent.click(dotAt('06:30'));
      expect(openRows()).toEqual([nightRow()]);
      fireEvent.click(dotAt('10:00'));
      expect(label()).toBe('Now, 10:00');
      // Nothing on the line is a setting.
      expect(seen.plan).toEqual(PLAN);
      expect(seen.value).toEqual(NIGHT);
      expect(document.querySelector('[data-day-slider] select, [data-day-slider] input')).toBeNull();
    });

    it('each switch has a colour of its own, the same on its stretches and dots of the line', async () => {
      render(<Harness initial={NIGHT} plan={PLAN} dashboards={THREE as never} />);
      await act(async () => {});
      const rowColor = (row: Element) => row.querySelector('[data-swatch]')!.getAttribute('data-swatch');
      const bus = document.querySelector('[data-day-span="0"]')!.getAttribute('data-color');
      const times = document.querySelector('[data-day-span="1"]')!.getAttribute('data-color');
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
      // Picking what it shows idle draws it idle, as the canvas's Idle does.
      pickResting('sky');
      expect(seen).toMatchObject({ tab: 'idle', half: 'day', preview: null });
      expect(label()).toBe('Step through the day to see the screen then.');
      expect(document.querySelector('[data-day-sheet]')!.hasAttribute('data-day-at')).toBe(false);
    });

    it('a dashboard edited on its own shows only night\'s start and end, and its own night', async () => {
      // Bus, not the household's default, is being edited.
      render(<Harness initial={NIGHT} plan={null} screenId={null} current={BUS} />);
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
