/**
 * @jest-environment jsdom
 *
 * The Through the day sheet (#1152): two lanes on one time axis (#1233), In
 * use and Idle, under one time marker. Tapping a lane at a time shows
 * the screen in that lane then; the slider moves the marker and keeps the
 * lane. The sheet sets what resting and night are. A timeline nobody gave a
 * night is stored as before. The Idle lane (#1170) has a dot where
 * night starts and ends, and In use a block per dashboard placed on the
 * timeline (#1266); tapping one shows the screen then and opens its card.
 * Days come first: a placement made on a set of days is one block on them.
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

function Harness({ initial, dashboards, timelines, screenId = null }: {
  initial: IdleBackground; dashboards?: typeof DASHBOARDS; timelines?: Timeline[]; screenId?: string | null;
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
      currentDashboardId={HOME}
      timelines={timelines ? lines : undefined}
      timelineId={timelines ? lineId : undefined}
      onTimelineChange={setLineId}
      screenId={screenId}
    />
  );
}

const radio = (group: string, name: string) =>
  Array.from(screen.getByRole('radiogroup', { name: group }).querySelectorAll<HTMLElement>('[role="radio"]')).find((b) => b.textContent === name)!;

afterEach(() => { localStorage.clear(); mockStore.patches = []; mockStore.created = []; mockStore.deleted = []; });

const milestone = (kind: 'night-start' | 'night-end') => document.querySelector<HTMLElement>(`[data-day-milestone="${kind}"]`)!;
/** The placements the last change kept. */
const keptPlacements = () => [...mockStore.patches].reverse().find((p) => 'placements' in p.patch)?.patch.placements as Timeline['placements'];
const blocks = () => Array.from(document.querySelectorAll<HTMLElement>('[data-day-placement]'));
const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
/** A day chip above the line. */
const day = (name: string) => fireEvent.click(screen.getByRole('group', { name: 'Each day' }).querySelector<HTMLElement>(`[aria-label="${name}"]`)!);

describe('ThroughTheDaySheet', () => {
  describe('two lanes on one time axis (#1233)', () => {
    // Both lanes are laid out 1440px wide from 0, so a tap at x is minute x.
    let rect: jest.SpyInstance;
    beforeEach(() => {
      rect = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
        { left: 0, right: 1440, width: 1440, top: 0, bottom: 44, height: 44, x: 0, y: 0, toJSON: () => ({}) } as DOMRect,
      );
    });
    afterEach(() => rect.mockRestore());
    const NIGHT_AT_9 = { day: 'photos', night: 'sky', switch: { by: 'clock', from: '21:00', to: '06:30' } } as const;
    const inUse = () => document.querySelector<HTMLElement>('[data-day-lane="in-use"]')!;
    /** The Idle stretch under a minute. */
    const nobodyAt = (minute: number) => Array.from(document.querySelectorAll<HTMLElement>('[data-day-stretch]'))
      .filter((el) => Number(el.dataset.key!.split('-')[1]) <= minute).pop()!;
    /** The minute the time marker is drawn at. */
    const marker = () => Math.round((parseFloat(document.querySelector<HTMLElement>('[data-day-now]')!.style.left) / 100) * 1440);
    const tap = (el: HTMLElement, minute: number) => fireEvent.click(el, { clientX: minute, detail: 1 });
    const key = (el: HTMLElement) => fireEvent.click(el, { detail: 0 });

    it('has no row of state buttons', () => {
      render(<Harness initial={NIGHT_AT_9} />);
      expect(document.querySelector('[data-day-state]')).toBeNull();
      expect(screen.queryByRole('radiogroup', { name: 'Show the screen' })).toBeNull();
      expect(screen.getByText('In use')).toBeTruthy();
      expect(screen.getByText('Idle')).toBeTruthy();
      expect(screen.queryByText('Nobody there')).toBeNull();
    });

    it('tapping In use at 22:00 shows the dashboard, with the marker at 22:00', () => {
      render(<Harness initial={NIGHT_AT_9} />);
      tap(nobodyAt(10 * 60), 10 * 60);
      tap(inUse(), 22 * 60);
      expect(seen.tab).toBe('dashboard');
      expect(marker()).toBe(22 * 60);
      expect(screen.getByText(/^At 22:00: in use\./)).toBeTruthy();
      expect(document.querySelector('[data-day-card]')).toBeNull();
    });

    it('tapping Idle at 22:00 shows night and its card, with the marker at 22:00', () => {
      render(<Harness initial={NIGHT_AT_9} />);
      tap(nobodyAt(22 * 60), 22 * 60);
      expect(seen).toMatchObject({ tab: 'idle', half: 'night' });
      expect(marker()).toBe(22 * 60);
      expect(document.querySelector('[data-day-card="night"]')).toBeTruthy();
      // At 10:00 the same lane is resting.
      tap(nobodyAt(10 * 60), 10 * 60);
      expect(seen).toMatchObject({ tab: 'idle', half: 'day' });
      expect(marker()).toBe(10 * 60);
      expect(document.querySelector('[data-day-card="resting"]')).toBeTruthy();
    });

    it('picking a lane does not move the marker', () => {
      render(<Harness initial={NIGHT_AT_9} />);
      fireEvent.change(screen.getByLabelText('Time of day'), { target: { value: String(22 * 60) } });
      expect(marker()).toBe(22 * 60);
      // Picked from the keyboard, with no point to tap: the marker stays.
      key(nobodyAt(22 * 60));
      expect(seen).toMatchObject({ tab: 'idle', half: 'night' });
      expect(marker()).toBe(22 * 60);
      key(inUse());
      expect(seen.tab).toBe('dashboard');
      expect(marker()).toBe(22 * 60);
    });

    it('the slider keeps the lane: In use stays the dashboard, Idle follows the time', () => {
      render(<Harness initial={NIGHT_AT_9} />);
      const slider = screen.getByLabelText('Time of day');
      tap(inUse(), 10 * 60);
      fireEvent.change(slider, { target: { value: String(22 * 60) } });
      expect(seen.tab).toBe('dashboard');
      expect(marker()).toBe(22 * 60);
      tap(nobodyAt(22 * 60), 22 * 60);
      fireEvent.change(slider, { target: { value: String(10 * 60) } });
      expect(seen).toMatchObject({ tab: 'idle', half: 'day' });
      fireEvent.change(slider, { target: { value: String(23 * 60) } });
      expect(seen).toMatchObject({ tab: 'idle', half: 'night' });
      expect(marker()).toBe(23 * 60);
    });
  });

  it('plays the day: on Idle, the slider shows the state at that time', () => {
    render(<Harness initial={{ day: 'dashboard', night: 'sky', switch: { by: 'clock', from: '21:00', to: '06:30' } }} />);
    fireEvent.click(document.querySelector<HTMLElement>('[data-day-stretch="resting"]')!);
    const slider = screen.getByLabelText('Time of day');
    fireEvent.change(slider, { target: { value: String(21 * 60 + 30) } });
    expect(seen).toMatchObject({ tab: 'idle', half: 'night' });
    expect(screen.getByText(/^At 21:30: night/)).toBeTruthy();
    fireEvent.change(slider, { target: { value: String(10 * 60) } });
    expect(seen).toMatchObject({ tab: 'idle', half: 'day' });
  });

  it('sets a night look that turns the screen off, on the default night', () => {
    render(<Harness initial={{ source: 'photos' }} />);
    fireEvent.click(milestone('night-start'));
    fireEvent.click(radio('Night look', 'Screen off'));
    expect(seen.value).toEqual({ day: 'photos', night: 'off', switch: DEFAULT_NIGHT });
    expect(seen.half).toBe('night');
  });

  it('turns dimming on when Dim this dashboard is chosen on a screen that does not dim', () => {
    render(<Harness initial={{ day: 'dashboard', night: 'sky', switch: DEFAULT_NIGHT }} />);
    fireEvent.click(milestone('night-start'));
    fireEvent.click(radio('Night look', 'Dim this dashboard'));
    expect(seen.value).toEqual({ source: 'dashboard' });
    expect(localStorage.getItem('prism-screensaver-dim')).toBe('0.5');
  });

  it('sets night by the clock instead of the sun', () => {
    render(<Harness initial={{ source: 'dashboard' }} />);
    fireEvent.click(milestone('night-start'));
    fireEvent.click(radio('When night is', 'Set times'));
    fireEvent.change(screen.getByLabelText('Night starts'), { target: { value: '22:15' } });
    expect(seen.value).toEqual({ day: 'dashboard', night: 'dashboard', switch: { by: 'clock', from: '22:15', to: '06:30' } });
  });

  it('moves the end of night from its dot', () => {
    render(<Harness initial={{ source: 'dashboard' }} />);
    fireEvent.click(milestone('night-end'));
    // The end's card has only the end.
    expect(screen.queryByLabelText('Starts: unit')).toBeNull();
    fireEvent.change(screen.getByLabelText('Ends: unit'), { target: { value: 'hr' } });
    fireEvent.change(screen.getByLabelText('Ends: amount'), { target: { value: '1' } });
    expect(seen.value).toEqual({ day: 'dashboard', night: 'dashboard', switch: { by: 'sun', duskOffset: 30, dawnOffset: -60 } });
  });

  it('puts a dot where night starts and ends, and tapping one shows the screen at night with its card', () => {
    render(<Harness initial={{ day: 'photos', night: 'sky', switch: { by: 'clock', from: '21:00', to: '06:30' } }} />);
    expect(milestone('night-end').style.left).toBe(`${(390 / 1440) * 100}%`);
    expect(milestone('night-start').style.left).toBe(`${(1260 / 1440) * 100}%`);
    // No card until something is tapped.
    expect(document.querySelector('[data-day-card]')).toBeNull();
    fireEvent.click(milestone('night-start'));
    expect(seen).toMatchObject({ tab: 'idle', half: 'night' });
    expect(document.querySelector('[data-day-card="night"]')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Night starts'), { target: { value: '22:00' } });
    // The dot follows its setting.
    expect(milestone('night-start').style.left).toBe(`${(1320 / 1440) * 100}%`);
  });

  it('tapping the resting stretch shows the screen resting and opens what resting is', () => {
    render(<Harness initial={{ day: 'photos', night: 'sky', switch: { by: 'clock', from: '21:00', to: '06:30' } }} />);
    fireEvent.click(document.querySelector<HTMLElement>('[data-day-stretch="resting"]')!);
    expect(seen).toMatchObject({ tab: 'idle', half: 'day' });
    fireEvent.click(radio('While resting', 'Night sky'));
    expect(seen.value).toMatchObject({ day: 'sky' });
    expect(screen.getByLabelText('Rest after')).toBeTruthy();
  });

  describe('placements on a set of days (#1266)', () => {
    const playSeven = () => {
      // The slider starts on the clock's hour, and a change to the value it
      // already shows fires nothing: going through another time first always
      // plays 7:00.
      fireEvent.change(screen.getByLabelText('Time of day'), { target: { value: String(10 * 60) } });
      fireEvent.change(screen.getByLabelText('Time of day'), { target: { value: String(7 * 60) } });
    };

    it('Weekdays, then + Dashboard: one block, on Monday to Friday and not on Saturday', () => {
      render(<Harness initial={{ source: 'dashboard' }} timelines={[MAIN]} />);
      press('Weekdays');
      playSeven();
      fireEvent.click(document.querySelector<HTMLElement>('[data-placement-add]')!);
      expect(keptPlacements()).toEqual([{ days: [1, 2, 3, 4, 5], from: '07:00', to: '08:00', dashboardId: BUS }]);
      // One block for the five days, not one a day.
      expect(blocks()).toHaveLength(1);
      expect(blocks()[0]!.textContent).toBe('Bus');
      expect([blocks()[0]!.dataset.from, blocks()[0]!.dataset.to]).toEqual(['420', '480']);

      // Saturday alone: nothing placed.
      press('Weekend');
      day('Sunday');
      expect(document.querySelector('[data-day-set]')!.getAttribute('data-day-set')).toBe('6');
      expect(blocks()).toHaveLength(0);
      // Monday alone: the same block.
      press('Weekdays');
      for (const d of ['Tuesday', 'Wednesday', 'Thursday', 'Friday']) day(d);
      expect(blocks()).toHaveLength(1);
      expect(blocks()[0]!.dataset.partial).toBeUndefined();
    });

    it('a placement on only some of the days shown says which', () => {
      render(<Harness initial={{ source: 'dashboard' }} timelines={[{ ...MAIN, placements: [{ days: [1], from: '07:00', to: '08:00', dashboardId: BUS }] }]} />);
      // Every day is shown at first.
      expect(blocks()).toHaveLength(1);
      expect(blocks()[0]!.dataset.partial).toBe('true');
      // Its days under its name, so they add no width.
      expect(blocks()[0]!.querySelector('[data-placement-name]')!.textContent).toBe('Bus');
      expect(blocks()[0]!.querySelector('[data-placement-days]')!.textContent).toBe('Mon');
      expect(blocks()[0]!.getAttribute('aria-label')).toMatch(/^Bus, Mon, /);
    });

    it('writes a block\'s days as days, so a dashboard called Weekend does not show the word twice', () => {
      render(<Harness initial={{ source: 'dashboard' }} timelines={[{ ...MAIN, placements: [
        { days: [1, 2, 3, 4, 5], from: '07:00', to: '08:00', dashboardId: BUS },
        { days: [6, 0], from: '10:00', to: '12:00', dashboardId: BUS },
      ] }]} />);
      const days = blocks().map((b) => b.querySelector('[data-placement-days]')!.textContent);
      expect(days).toEqual(['Mon–Fri', 'Sat, Sun']);
      // Read aloud in words.
      expect(blocks()[0]!.getAttribute('aria-label')).toMatch(/^Bus, Weekdays, /);
    });

    it('edits a placement in its card and removes it', () => {
      render(<Harness initial={{ source: 'dashboard' }} timelines={[MAIN]} />);
      press('Weekdays');
      playSeven();
      fireEvent.click(document.querySelector<HTMLElement>('[data-placement-add]')!);
      fireEvent.change(screen.getByLabelText('Placement ends'), { target: { value: '08:30' } });
      expect(keptPlacements()[0]!.to).toBe('08:30');
      expect(blocks()[0]!.dataset.to).toBe('510');
      // Its days, in the card: one more.
      fireEvent.click(screen.getByRole('group', { name: 'Placement days' }).querySelector<HTMLElement>('[aria-label="Saturday"]')!);
      expect(keptPlacements()[0]!.days).toContain(6);

      fireEvent.click(document.querySelector<HTMLElement>('[data-placement-remove]')!);
      expect(keptPlacements()).toEqual([]);
      expect(blocks()).toHaveLength(0);
    });

    it('moves a placement up the order that decides an overlap', () => {
      render(<Harness initial={{ source: 'dashboard' }} timelines={[{ ...MAIN, placements: [
        { days: [0, 1, 2, 3, 4, 5, 6], from: '07:00', to: '09:00', dashboardId: HOME },
        { days: [0, 1, 2, 3, 4, 5, 6], from: '08:00', to: '10:00', dashboardId: BUS },
      ] }]} />);
      // Bus is second, so Home wins 8:00 to 9:00.
      fireEvent.change(screen.getByLabelText('Time of day'), { target: { value: String(8 * 60 + 30) } });
      expect(screen.getByText(/, Home shows/)).toBeTruthy();
      fireEvent.click(document.querySelector<HTMLElement>('[data-day-placement="1"]')!);
      press('Move this one up');
      expect(keptPlacements().map((p) => p.dashboardId)).toEqual([BUS, HOME]);
      expect(screen.getByText(/This is 1 of 2/)).toBeTruthy();
      // A placement is on In use: the dashboard it shows, at its time.
      expect(seen.tab).toBe('dashboard');
    });

    it('In use shows the dashboard for the rest of the day, and its card changes it', () => {
      render(<Harness initial={{ source: 'dashboard' }} timelines={[MAIN]} />);
      const inUse = document.querySelector<HTMLElement>('[data-day-lane="in-use"]')!;
      expect(inUse.textContent).toBe('Home');
      fireEvent.click(inUse);
      fireEvent.change(screen.getByLabelText('Dashboard for the rest of the day'), { target: { value: BUS } });
      expect(mockStore.patches.at(-1)).toEqual({ id: 'main', patch: { dashboardId: BUS } });
      expect(inUse.textContent).toBe('Bus');
    });
  });

  describe('the timeline (#1266)', () => {
    const OTHER: Timeline = { ...MAIN, id: 'other', name: 'Quiet', position: 1, screens: 0 };

    it('says who uses it before a change that reaches several screens', () => {
      render(<Harness initial={{ source: 'dashboard' }} timelines={[MAIN, OTHER]} />);
      expect(document.querySelector('[data-timeline-used]')!.textContent).toBe('Used by 2 screens, and every device not given another.');
      fireEvent.change(screen.getByLabelText('Timeline'), { target: { value: 'other' } });
      expect(seen.timelineId).toBe('other');
      expect(document.querySelector('[data-timeline-used]')!.textContent).toBe('No screen uses it yet.');
    });

    it('a screen being edited follows the timeline picked', () => {
      render(<Harness initial={{ source: 'dashboard' }} timelines={[MAIN, OTHER]} screenId="kitchen" />);
      expect(screen.getByText('This screen follows')).toBeTruthy();
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

    it('without a timeline there is nothing to place', () => {
      render(<Harness initial={{ source: 'dashboard' }} />);
      expect(document.querySelector('[data-placement-add]')).toBeNull();
      expect(document.querySelector('[data-timeline-bar]')).toBeNull();
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
