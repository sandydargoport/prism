/**
 * @jest-environment jsdom
 *
 * The Through the day sheet (#1152) as plain rows (#1281). For a screen: the
 * timeline it follows (#1266), the dashboard it shows and the dashboards it
 * switches to at set times, a row each. Then the dashboard's own resting and
 * night: plain choices in a row, Photos and the night sky among them, saved
 * with the dashboard. Rest after and How dark are the screen's own, shown
 * only when the editor is for a screen. See it shows the canvas in use,
 * resting or at night. A dashboard nobody gave a night is stored as before.
 */
import React, { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { simplest, ThroughTheDaySheet } from '../ThroughTheDaySheet';
import { idleSaveProblem } from '../IdleBackgroundBar';
import type { IdleBackground } from '@/lib/idleBackground';
import type { EditTab, IdleHalf } from '@/components/dashboard/useDashboardLayout';
import { DEFAULT_NIGHT } from '@/lib/throughTheDay';
import type { Timeline } from '@/lib/timeline';

jest.mock('@/components/providers/TimeFormatProvider', () => ({
  // The household's clock is the screen's, as on a real screen.
  useTimeFormat: () => ({ timeFormat: '24h', householdTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
}));
jest.mock('@/components/screensaver/useIdleBackground', () => ({
  useSkyLocation: () => ({ lat: 45, lon: -100 }),
}));
jest.mock('@/components/screensaver/ScreensaverQuickSettings', () => ({ ScreensaverSettingsPanel: () => null }));
// The timelines store: a change is kept by the harness, as the server would.
const mockStore = {
  patches: [] as Array<{ id: string; patch: Record<string, unknown> }>,
  created: [] as Array<Record<string, unknown>>,
  deleted: [] as string[],
  apply: (_id: string, _patch: Record<string, unknown>) => {},
  add: (_t: Timeline) => {},
};
jest.mock('@/lib/hooks/useTimelines', () => ({
  patchTimeline: async (id: string, patch: Record<string, unknown>) => { mockStore.patches.push({ id, patch }); mockStore.apply(id, patch); return true; },
  createTimeline: async (body: Record<string, unknown>) => {
    mockStore.created.push(body);
    const t = { id: `new-${mockStore.created.length}`, name: String(body.name), position: 9, dashboardId: null, placements: [], idleBackground: { source: 'dashboard' }, screens: 0 };
    mockStore.add(t as Timeline);
    return t;
  },
  deleteTimeline: async (id: string) => { mockStore.deleted.push(id); return true; },
}));

const HOME = '11111111-1111-4111-8111-111111111111';
const BUS = '22222222-2222-4222-8222-222222222222';
const DASHBOARDS = [
  { id: HOME, name: 'Home', slug: 'home', isDefault: true },
  { id: BUS, name: 'Bus', slug: 'bus', isDefault: false },
];
const MAIN: Timeline = { id: 'main', name: 'Main', position: 0, dashboardId: null, placements: [], idleBackground: { source: 'dashboard' }, screens: 2 };

const seen: { value?: IdleBackground; half?: IdleHalf; tab?: EditTab; timelineId?: string } = {};

function Harness({ initial, dashboards, timelines, screenId = 'kitchen', forScreen = true, current = HOME }: {
  initial: IdleBackground; dashboards?: typeof DASHBOARDS; timelines?: Timeline[]; screenId?: string | null; forScreen?: boolean; current?: string;
}) {
  const [value, setValue] = useState(initial);
  const [half, setHalf] = useState<IdleHalf>('day');
  const [tab, setTab] = useState<EditTab>('dashboard');
  const [lines, setLines] = useState<Timeline[]>(timelines ?? []);
  const [lineId, setLineId] = useState<string | undefined>(timelines?.[0]?.id);
  React.useEffect(() => {
    mockStore.apply = (id, patch) => setLines((all) => all.map((t) => (t.id === id ? { ...t, ...patch } as Timeline : t)));
    mockStore.add = (t) => setLines((all) => [...all, t]);
  }, []);
  React.useEffect(() => { seen.value = value; seen.half = half; seen.tab = tab; seen.timelineId = lineId; });
  return (
    <ThroughTheDaySheet
      idleBackground={value} onIdleBackgroundChange={setValue}
      idleHalf={half} onIdleHalfChange={setHalf}
      editTab={tab} onEditTabChange={setTab}
      idleCheck={{}}
      allDashboards={(dashboards ?? DASHBOARDS) as never}
      currentDashboardId={current}
      onSwitchDashboard={switched}
      timelines={timelines ? lines : undefined}
      timelineId={timelines ? lineId : undefined}
      onTimelineChange={setLineId}
      screenId={screenId}
      forScreen={forScreen}
    />
  );
}
const switched = jest.fn();

afterEach(() => { localStorage.clear(); mockStore.patches = []; mockStore.created = []; mockStore.deleted = []; switched.mockReset(); });

/** The placements the last change kept. */
const keptPlacements = () => [...mockStore.patches].reverse().find((p) => 'placements' in p.patch)?.patch.placements as Timeline['placements'];
const rows = () => Array.from(document.querySelectorAll<HTMLElement>('[data-placement-row]'));
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
      // The dashboard's rows, then the screen's own.
      expect(Array.from(document.querySelectorAll('[data-row-name]')).map((n) => n.textContent))
        .toEqual(['Resting', 'At night', 'Night is', 'Rest after', 'How dark']);
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

  describe('switches at set times (#1266, #1281)', () => {
    beforeEach(() => {
      // Only the date is faked: a new switch starts at this quarter hour.
      jest.useFakeTimers({ now: new Date(2026, 10, 23, 7, 5), doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'queueMicrotask', 'nextTick'] });
    });
    afterEach(() => jest.useRealTimers());

    it('+ Switch at set times adds a row on every day from this quarter hour, and its days and hours change in it', () => {
      render(<Harness initial={{ source: 'dashboard' }} timelines={[MAIN]} />);
      press('Switch at set times');
      expect(keptPlacements()).toEqual([{ days: [0, 1, 2, 3, 4, 5, 6], from: '07:00', to: '08:00', dashboardId: BUS }]);
      expect(rows()).toHaveLength(1);
      // Weekdays: Saturday and Sunday off.
      const days = rows()[0]!.querySelector<HTMLElement>('[aria-label="Switch days"]')!;
      fireEvent.click(days.querySelector<HTMLElement>('[aria-label="Saturday"]')!);
      fireEvent.click(days.querySelector<HTMLElement>('[aria-label="Sunday"]')!);
      expect(keptPlacements()[0]!.days).toEqual([1, 2, 3, 4, 5]);
      fireEvent.change(screen.getByLabelText('Switch ends'), { target: { value: '08:30' } });
      expect(keptPlacements()[0]!.to).toBe('08:30');
      fireEvent.change(screen.getByLabelText('Switches to'), { target: { value: HOME } });
      expect(keptPlacements()[0]!.dashboardId).toBe(HOME);

      fireEvent.click(document.querySelector<HTMLElement>('[data-placement-remove]')!);
      expect(keptPlacements()).toEqual([]);
      expect(rows()).toHaveLength(0);
    });

    it('a switch keeps at least one day', () => {
      render(<Harness initial={{ source: 'dashboard' }} timelines={[{ ...MAIN, placements: [{ days: [1], from: '07:00', to: '08:00', dashboardId: BUS }] }]} />);
      expect((rows()[0]!.querySelector<HTMLButtonElement>('[aria-label="Monday"]')!).disabled).toBe(true);
    });

    it('moves a switch up the order that decides an overlap', () => {
      render(<Harness initial={{ source: 'dashboard' }} timelines={[{ ...MAIN, placements: [
        { days: [0, 1, 2, 3, 4, 5, 6], from: '07:00', to: '09:00', dashboardId: HOME },
        { days: [0, 1, 2, 3, 4, 5, 6], from: '08:00', to: '10:00', dashboardId: BUS },
      ] }]} />);
      expect(screen.getByText('If two overlap, the higher one wins.')).toBeTruthy();
      // The first has nothing above it.
      expect(rows()[0]!.querySelector('[data-placement-up]')).toBeNull();
      fireEvent.click(rows()[1]!.querySelector<HTMLElement>('[data-placement-up]')!);
      expect(keptPlacements().map((p) => p.dashboardId)).toEqual([BUS, HOME]);
    });

    it('Shows is the dashboard the screen shows, and a switch\'s Open opens its dashboard', () => {
      render(<Harness initial={{ source: 'dashboard' }} timelines={[{ ...MAIN, placements: [{ days: [1], from: '07:00', to: '08:00', dashboardId: BUS }] }]} />);
      expect((screen.getByLabelText('Dashboard this screen shows') as HTMLSelectElement).value).toBe(HOME);
      fireEvent.click(rows()[0]!.querySelector<HTMLElement>(`[data-dashboard-open="${BUS}"]`)!);
      expect(switched).toHaveBeenCalledWith('bus');
      pick('Dashboard this screen shows', BUS);
      expect(mockStore.patches.at(-1)).toEqual({ id: 'main', patch: { dashboardId: BUS } });
    });

    it('a dashboard edited on its own has no screen, so nothing to follow or switch', () => {
      render(<Harness initial={{ source: 'dashboard' }} timelines={[MAIN]} screenId={null} forScreen={false} />);
      expect(document.querySelector('[data-timeline-bar]')).toBeNull();
      expect(document.querySelector('[data-placement-add]')).toBeNull();
      expect(screen.queryByLabelText('Dashboard this screen shows')).toBeNull();
    });
  });

  describe('the timeline (#1266)', () => {
    const OTHER: Timeline = { ...MAIN, id: 'other', name: 'Quiet', position: 1, screens: 0 };

    it('says who uses it before a change that reaches several screens', () => {
      render(<Harness initial={{ source: 'dashboard' }} timelines={[MAIN, OTHER]} />);
      expect(screen.getByText('This screen follows')).toBeTruthy();
      expect(document.querySelector('[data-timeline-used]')!.textContent).toBe('Used by 2 screens, and every device not given another.');
      fireEvent.change(screen.getByLabelText('Timeline'), { target: { value: 'other' } });
      expect(seen.timelineId).toBe('other');
      expect(document.querySelector('[data-timeline-used]')!.textContent).toBe('No screen uses it yet.');
    });

    /** Picks one of the timeline's own actions from the menu beside its dropdown. */
    const fromMenu = (item: string) => { press('Timeline actions'); press(item); };

    it('keeps its own actions in a menu beside the dropdown, closed until asked for', () => {
      render(<Harness initial={{ source: 'dashboard' }} timelines={[MAIN, OTHER]} />);
      const items = () => ['Rename', 'Duplicate', 'New timeline', 'Delete'].map((name) => screen.queryByRole('button', { name }));
      expect(items().every((b) => b === null)).toBe(true);
      press('Timeline actions');
      expect(screen.getByRole('button', { name: 'Timeline actions' }).getAttribute('aria-expanded')).toBe('true');
      expect(items().every((b) => b !== null)).toBe(true);
      // Escape closes it, and so does a press anywhere else.
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(items().every((b) => b === null)).toBe(true);
      press('Timeline actions');
      fireEvent.pointerDown(document.body);
      expect(items().every((b) => b === null)).toBe(true);
    });

    it('duplicates the timeline and moves to the copy', async () => {
      render(<Harness initial={{ source: 'dashboard' }} timelines={[MAIN]} />);
      fromMenu('Duplicate');
      expect((screen.getByLabelText('Name for the new timeline') as HTMLInputElement).value).toBe('Main copy');
      await act(async () => { press('Duplicate'); });
      expect(mockStore.created).toEqual([{ copyOf: 'main', name: 'Main copy' }]);
      expect(seen.timelineId).toBe('new-1');
    });

    it('renames it', async () => {
      render(<Harness initial={{ source: 'dashboard' }} timelines={[MAIN]} />);
      fromMenu('Rename');
      fireEvent.change(screen.getByLabelText('New name for this timeline'), { target: { value: 'School days' } });
      await act(async () => { press('Rename'); });
      expect(mockStore.patches.at(-1)).toEqual({ id: 'main', patch: { name: 'School days' } });
    });

    it('the last timeline cannot be deleted; another can, and its screens go to the first', async () => {
      const { unmount } = render(<Harness initial={{ source: 'dashboard' }} timelines={[MAIN]} />);
      press('Timeline actions');
      expect((screen.getByRole('button', { name: 'Delete' }) as HTMLButtonElement).disabled).toBe(true);
      unmount();
      render(<Harness initial={{ source: 'dashboard' }} timelines={[{ ...OTHER, screens: 1 }, MAIN].reverse()} />);
      fireEvent.change(screen.getByLabelText('Timeline'), { target: { value: 'other' } });
      fromMenu('Delete');
      expect(screen.getByText('The screen on it follows Main instead.')).toBeTruthy();
      await act(async () => { press('Delete'); });
      expect(mockStore.deleted).toEqual(['other']);
      expect(seen.timelineId).toBe('main');
    });
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
