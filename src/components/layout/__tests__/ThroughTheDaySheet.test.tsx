/**
 * @jest-environment jsdom
 *
 * The Through the day sheet (#1152): two lanes on one time axis (#1233), In
 * use and Nobody there, under one time marker. Tapping a lane at a time shows
 * the screen in that lane then; the slider moves the marker and keeps the
 * lane. The sheet sets what resting and night are. A dashboard nobody gave a
 * night is stored as before. The Nobody there lane (#1170) has a dot where
 * night starts and ends, and In use a block per Interlude; tapping one shows
 * the screen then and opens its card.
 */
import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { daysInWords, simplest, ThroughTheDaySheet } from '../ThroughTheDaySheet';
import { idleSaveProblem } from '../IdleBackgroundBar';
import type { IdleBackground } from '@/lib/idleBackground';
import type { EditTab, IdleHalf } from '@/components/dashboard/useDashboardLayout';
import { DEFAULT_NIGHT } from '@/lib/throughTheDay';

jest.mock('@/components/providers/TimeFormatProvider', () => ({
  // The household's clock is the screen's, as on a real screen.
  useTimeFormat: () => ({ timeFormat: '24h', householdTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
}));
jest.mock('@/components/screensaver/useIdleBackground', () => ({
  useSkyLocation: () => ({ lat: 45, lon: -100 }),
}));
jest.mock('@/components/screensaver/ScreensaverQuickSettings', () => ({ ScreensaverSettingsPanel: () => null }));
let mockNamed: { displayId: string; dashboardId: string | null; settings: Record<string, string> } | null = null;
jest.mock('@/lib/displays/displaySettingsSync', () => ({ loadBase: () => mockNamed }));

const DASHBOARDS = [
  { id: 'home', name: 'Home', slug: 'home', isDefault: true },
  { id: 'bus', name: 'Bus', slug: 'bus' },
];

const seen: { value?: IdleBackground; half?: IdleHalf; tab?: EditTab } = {};

function Harness({ initial, dashboards }: { initial: IdleBackground; dashboards?: typeof DASHBOARDS }) {
  const [value, setValue] = useState(initial);
  const [half, setHalf] = useState<IdleHalf>('day');
  const [tab, setTab] = useState<EditTab>('dashboard');
  React.useEffect(() => { seen.value = value; seen.half = half; seen.tab = tab; });
  return (
    <ThroughTheDaySheet
      idleBackground={value} onIdleBackgroundChange={setValue}
      idleHalf={half} onIdleHalfChange={setHalf}
      editTab={tab} onEditTabChange={setTab}
      idleCheck={{}}
      allDashboards={dashboards as never}
      currentDashboardId="home"
    />
  );
}

const radio = (group: string, name: string) =>
  Array.from(screen.getByRole('radiogroup', { name: group }).querySelectorAll<HTMLElement>('[role="radio"]')).find((b) => b.textContent === name)!;

afterEach(() => { localStorage.clear(); mockNamed = null; });

const milestone = (kind: 'night-start' | 'night-end') => document.querySelector<HTMLElement>(`[data-day-milestone="${kind}"]`)!;
const SCHEDULE = 'prism-screen-schedule';

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
    /** The Nobody there stretch under a minute. */
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
      expect(screen.getByText('Nobody there')).toBeTruthy();
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

    it('tapping Nobody there at 22:00 shows night and its card, with the marker at 22:00', () => {
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

    it('the slider keeps the lane: In use stays the dashboard, Nobody there follows the time', () => {
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

  it('plays the day: on Nobody there, the slider shows the state at that time', () => {
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

  it('adds an Interlude on the line, edits it in its card and removes it, on a named screen', () => {
    mockNamed = { displayId: 'd1', dashboardId: 'home', settings: {} };
    render(<Harness initial={{ source: 'dashboard' }} dashboards={DASHBOARDS} />);
    // The slider starts on the clock's hour, and a change to the value it
    // already shows fires nothing: between 7 and 8 in the zone the suite runs
    // in, setting 7:00 left it unplayed and the Interlude took the clock's
    // quarter hour. Going through another time first always plays 7:00.
    fireEvent.change(screen.getByLabelText('Time of day'), { target: { value: String(10 * 60) } });
    fireEvent.change(screen.getByLabelText('Time of day'), { target: { value: String(7 * 60) } });
    fireEvent.click(document.querySelector<HTMLElement>('[data-interlude-add]')!);
    const today = new Date().getDay();
    expect(JSON.parse(localStorage.getItem(SCHEDULE)!)).toEqual([{ days: [today], from: '07:00', to: '08:00', dashboardId: 'bus' }]);
    const block = document.querySelector<HTMLElement>('[data-day-interlude="0"]')!;
    expect(block.textContent).toBe('Bus');
    expect([block.dataset.from, block.dataset.to]).toEqual(['420', '480']);

    fireEvent.change(screen.getByLabelText('Interlude ends'), { target: { value: '08:30' } });
    expect(JSON.parse(localStorage.getItem(SCHEDULE)!)[0].to).toBe('08:30');
    expect(document.querySelector<HTMLElement>('[data-day-interlude="0"]')!.dataset.to).toBe('510');

    fireEvent.click(document.querySelector<HTMLElement>('[data-interlude-remove]')!);
    expect(localStorage.getItem(SCHEDULE)).toBeNull();
    expect(document.querySelector('[data-day-interlude]')).toBeNull();
  });

  it('moves an Interlude up the order that decides an overlap', () => {
    mockNamed = { displayId: 'd1', dashboardId: 'home', settings: {} };
    const today = new Date().getDay();
    localStorage.setItem(SCHEDULE, JSON.stringify([
      { days: [today], from: '07:00', to: '09:00', dashboardId: 'home' },
      { days: [today], from: '08:00', to: '10:00', dashboardId: 'bus' },
    ]));
    render(<Harness initial={{ source: 'dashboard' }} dashboards={DASHBOARDS} />);
    // Bus is second, so Home wins 8:00 to 9:00.
    fireEvent.change(screen.getByLabelText('Time of day'), { target: { value: String(8 * 60 + 30) } });
    expect(screen.getByText(/, Home shows/)).toBeTruthy();
    fireEvent.click(document.querySelector<HTMLElement>('[data-day-interlude="1"]')!);
    fireEvent.click(screen.getByRole('button', { name: 'Move this Interlude up' }));
    expect(JSON.parse(localStorage.getItem(SCHEDULE)!).map((r: { dashboardId: string }) => r.dashboardId)).toEqual(['bus', 'home']);
    expect(screen.getByText(/This one is 1 of 2/)).toBeTruthy();
  });

  it('shows another weekday on the line, with that day\'s Interludes', () => {
    mockNamed = { displayId: 'd1', dashboardId: 'home', settings: {} };
    const other = (new Date().getDay() + 3) % 7;
    localStorage.setItem(SCHEDULE, JSON.stringify([{ days: [other], from: '09:00', to: '10:00', dashboardId: 'bus' }]));
    render(<Harness initial={{ source: 'dashboard' }} dashboards={DASHBOARDS} />);
    // Not on today.
    expect(document.querySelector('[data-day-interlude]')).toBeNull();
    fireEvent.change(screen.getByLabelText('Day shown'), { target: { value: String(other) } });
    fireEvent.click(document.querySelector<HTMLElement>('[data-day-interlude="0"]')!);
    expect(document.querySelector('[data-day-card="interlude"]')).toBeTruthy();
    // An Interlude is on In use: the dashboard it shows, at its start.
    expect(seen.tab).toBe('dashboard');
    expect(screen.getByText(/^At 09:00: in use, Bus shows/)).toBeTruthy();
  });

  it('asks for a named screen before it offers Interludes', () => {
    render(<Harness initial={{ source: 'dashboard' }} />);
    expect(document.querySelector('[data-interludes-unnamed]')).toBeTruthy();
  });
});

describe('simplest', () => {
  it('stores one background when day and night match on the default rule', () => {
    expect(simplest({ day: 'photos', night: 'photos', switch: DEFAULT_NIGHT })).toEqual({ source: 'photos' });
    const own = { day: 'photos' as const, night: 'photos' as const, switch: { by: 'sun' as const, duskOffset: 0, dawnOffset: 0 } };
    expect(simplest(own)).toBe(own);
  });
});

describe('daysInWords', () => {
  it('names the common sets', () => {
    expect(daysInWords([1, 2, 3, 4, 5])).toBe('Weekdays');
    expect(daysInWords([0, 6])).toBe('Weekends');
    expect(daysInWords([0, 1, 2, 3, 4, 5, 6])).toBe('Every day');
    expect(daysInWords([2, 4])).toBe('Tue, Thu');
  });
});

describe('idleSaveProblem', () => {
  it('refuses a night that starts and ends at the same time, and crossed offsets', () => {
    expect(idleSaveProblem({ day: 'dashboard', night: 'sky', switch: { by: 'clock', from: '21:00', to: '21:00' } }, {})).toMatch(/different times/);
    expect(idleSaveProblem({ source: 'dashboard' }, { crossed: new Date() })).toBeNull();
    expect(idleSaveProblem({ day: 'dashboard', night: 'sky', switch: DEFAULT_NIGHT }, { crossed: new Date() })).toMatch(/offsets/);
  });
});
