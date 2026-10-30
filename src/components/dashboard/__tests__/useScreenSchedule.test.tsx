/**
 * @jest-environment jsdom
 */
/**
 * A named screen following its time-of-day rules while it stays on (#692):
 * which dashboard it shows on opening, when someone picks another by hand, and
 * when the layout is being edited. The change waiting for an untouched screen,
 * and the morph, are measured in the browser (e2e/display-registry.spec.ts).
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
  localStorage.clear();
  localStorage.setItem('prism:display-sync-base', JSON.stringify({ displayId: 'screen', dashboardId: null, settings: {}, settingsUpdatedAt: null }));
  localStorage.setItem('prism-screen-schedule', JSON.stringify([
    { days: [1, 2, 3, 4, 5], from: '07:00', to: '08:00', dashboardId: MORNING },
  ]));
});
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

  it('a browser that is not a named screen ignores a leftover schedule', () => {
    localStorage.removeItem('prism:display-sync-base');
    const { result } = open(undefined, '07:10');
    expect(result.current.slug).toBeUndefined();
  });
});
