/**
 * @jest-environment jsdom
 */
/**
 * A named screen following its own dashboard and switches while it stays on
 * (#692, #1282): which dashboard it shows on opening, at set times and at bus
 * time, when someone picks another by hand, and when the layout is being
 * edited. A device nobody named shows the default and switches nothing. The
 * change waiting for an untouched screen, and the morph, are measured in the
 * browser (e2e/display-registry.spec.ts).
 */
import * as React from 'react';
import { act, renderHook } from '@testing-library/react';
import type { Layout } from '@/lib/hooks/useLayouts';

jest.mock('@/components/providers/TimeFormatProvider', () => ({
  useTimeFormat: () => ({ householdTimezone: 'UTC' }),
}));
jest.mock('@/lib/hooks/usePerformanceMode', () => ({ usePerformanceLevel: () => 'full' }));
// The check runs when the test says, not on a timer.
let check: () => void = () => {};
jest.mock('@/lib/hooks/useVisibilityPolling', () => ({
  useVisibilityPolling: (callback: () => void) => { check = callback; },
}));

/** The bus routes the status endpoint answers with. */
let routes: Array<{ scheduledTime: string; activeDays: number[] }> = [];

const HOME = '11111111-1111-4111-8111-111111111111';
const MORNING = '22222222-2222-4222-8222-222222222222';
const EVENING = '33333333-3333-4333-8333-333333333333';

const layout = (id: string, slug: string | null, extra: Partial<Layout> = {}) =>
  ({ id, slug, name: slug ?? 'Default', isDefault: slug === null, fontScale: null, widgets: [], ...extra }) as unknown as Layout;
const LAYOUTS = [layout(HOME, null), layout(MORNING, 'morning', { fontScale: 120 }), layout(EVENING, 'evening')];

// 2026-11-02 is a Monday; the household zone here is UTC.
const at = (hhmm: string) => new Date(`2026-11-02T${hhmm}:00Z`).getTime();

let useScreenSchedule: typeof import('../useScreenSchedule').useScreenSchedule;

beforeEach(() => {
  // The hook remembers the first open of a page load at module level, so each
  // test is a fresh page load: a fresh copy of it, on the same React.
  jest.isolateModules(() => {
    jest.doMock('react', () => React);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ({ useScreenSchedule } = require('../useScreenSchedule'));
  });
  jest.useFakeTimers();
  window.history.replaceState(null, '', '/');
  localStorage.clear();
  plan({ dashboardId: null, switches: [{ when: 'times', days: [1, 2, 3, 4, 5], from: '07:00', to: '08:00', dashboardId: MORNING }] });
  routes = [];
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ routes }) })) as never;
});

/** This browser is a named screen with this dashboard and these switches. */
function plan(p: { dashboardId: string | null; switches: unknown[] }) {
  localStorage.setItem('prism:display-sync-base', JSON.stringify({ displayId: 'screen', ...p, settings: {}, settingsUpdatedAt: null }));
}
afterEach(() => jest.useRealTimers());

function open(routeSlug: string | undefined, now: string, editing = { current: false }) {
  jest.setSystemTime(at(now));
  return renderHook(
    ({ slug }) => useScreenSchedule({ routeSlug: slug, layouts: LAYOUTS, loading: false, editing }),
    { initialProps: { slug: routeSlug } },
  );
}

function tick(now: string) {
  jest.setSystemTime(at(now));
  act(() => check());
}

describe('useScreenSchedule', () => {
  it('opens on the scheduled dashboard, and at its own text size', () => {
    const { result } = open(undefined, '07:10');
    expect(result.current.slug).toBe('morning');
    expect(result.current.zoomStyle).toMatchObject({ zoom: 1.2 });
  });

  it('opens on its own dashboard outside every rule, and changes over when one starts', () => {
    const { result } = open(undefined, '06:59');
    expect(result.current.slug).toBeUndefined();
    expect(result.current.zoomStyle).toBeUndefined();
    tick('07:00');
    expect(result.current.slug).toBe('morning');
    tick('08:00');
    expect(result.current.slug).toBeUndefined();
  });

  it('a switch changes a screen on Today too, at its start (#1152)', () => {
    const today = [layout(HOME, null, { view: 'today' } as Partial<Layout>), ...LAYOUTS.slice(1)];
    jest.setSystemTime(at('06:59'));
    const { result } = renderHook(() => useScreenSchedule({ routeSlug: undefined, layouts: today, loading: false, editing: { current: false } }));
    expect(result.current.slug).toBeUndefined();
    tick('07:00');
    expect(result.current.slug).toBe('morning');
  });

  it('the first open of a page load follows the schedule, whatever the address', () => {
    // A reload at an address an earlier change over left behind.
    const { result } = open('morning', '09:00');
    expect(result.current.slug).toBeUndefined();
  });

  it('a dashboard picked by hand stays until the rule in force changes', () => {
    const { result } = open(undefined, '07:10');
    act(() => result.current.pick('evening'));
    expect(result.current.slug).toBe('evening');
    tick('07:59');
    expect(result.current.slug).toBe('evening');
    tick('08:00');
    expect(result.current.slug).toBeUndefined();
  });

  it('a dashboard opened later from inside the app counts as picked by hand', () => {
    const { result, rerender } = open(undefined, '06:30');
    rerender({ slug: 'evening' });
    expect(result.current.slug).toBe('evening');
    tick('06:45');
    expect(result.current.slug).toBe('evening');
    // Morning starts: the schedule takes over again.
    tick('07:00');
    expect(result.current.slug).toBe('morning');
  });

  it('picking the dashboard the schedule wants holds nothing', () => {
    const { result } = open(undefined, '07:10');
    act(() => result.current.pick('evening'));
    act(() => result.current.pick('morning'));
    tick('07:20');
    expect(result.current.slug).toBe('morning');
    tick('08:00');
    expect(result.current.slug).toBeUndefined();
  });

  it('waits while the layout is being edited', () => {
    const editing = { current: true };
    const { result } = open(undefined, '06:59', editing);
    tick('07:05');
    expect(result.current.slug).toBeUndefined();
    editing.current = false;
    tick('07:06');
    expect(result.current.slug).toBe('morning');
  });

  describe('a device nobody named', () => {
    beforeEach(() => localStorage.removeItem('prism:display-sync-base'));

    it('shows the default on the home page and switches nothing', () => {
      const { result } = open(undefined, '07:10');
      expect(result.current.slug).toBeUndefined();
      tick('07:30');
      expect(result.current.slug).toBeUndefined();
    });

    it('keeps a dashboard opened at its own address', () => {
      const { result } = open('evening', '07:10');
      expect(result.current.slug).toBe('evening');
      tick('07:30');
      expect(result.current.slug).toBe('evening');
    });
  });

  it('shows its own dashboard outside every switch', () => {
    plan({ dashboardId: EVENING, switches: [{ when: 'times', days: [1, 2, 3, 4, 5], from: '07:00', to: '08:00', dashboardId: MORNING }] });
    const { result } = open(undefined, '12:00');
    expect(result.current.slug).toBe('evening');
    tick('07:00');
    expect(result.current.slug).toBe('morning');
  });

  it('at bus time it shows the bus dashboard, morning and afternoon, and its own outside it', async () => {
    plan({ dashboardId: null, switches: [{ when: 'bus', dashboardId: MORNING }] });
    // Due at the stop at 7:45 and 15:30 on weekdays (the household zone here is UTC).
    routes = [{ scheduledTime: '07:45', activeDays: [1, 2, 3, 4, 5] }, { scheduledTime: '15:30', activeDays: [1, 2, 3, 4, 5] }];
    const { result } = open(undefined, '07:00');
    await act(async () => {});
    expect(global.fetch).toHaveBeenCalledWith('/api/bus-tracking/status');
    tick('07:14');
    expect(result.current.slug).toBeUndefined();
    tick('07:15');
    expect(result.current.slug).toBe('morning');
    tick('08:00');
    expect(result.current.slug).toBe('morning');
    tick('08:01');
    expect(result.current.slug).toBeUndefined();
    tick('15:00');
    expect(result.current.slug).toBe('morning');
    tick('15:46');
    expect(result.current.slug).toBeUndefined();
  });

  it('reads no bus times when it has no bus switch', async () => {
    open(undefined, '07:10');
    await act(async () => {});
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
