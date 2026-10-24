/**
 * @jest-environment jsdom
 */
/**
 * A calendar opens on today in the display's time zone, and moves to that
 * zone's today when the zone changes (the household's zone arriving after the
 * first render, or the display switched between device and household zone).
 * The first render already has the zone's date, so the device's date is never
 * painted first.
 */
import { createElement, useLayoutEffect } from 'react';
import { render } from '@testing-library/react';
import { format } from 'date-fns';
import { useCalendarWidgetPrefs } from '../useCalendarWidgetPrefs';

let zone = 'Pacific/Kiritimati';
jest.mock('@/components/providers', () => ({ useTimeFormat: () => ({ displayTimezone: zone }) }));

/**
 * The date each committed render showed. Recorded in a layout effect, which
 * runs before paint: a render React throws away and redoes never reaches the
 * screen, so it is not counted.
 */
function datesShown() {
  const seen: string[] = [];
  function Probe() {
    const shown = format(useCalendarWidgetPrefs(4, 4).currentDate, 'yyyy-MM-dd');
    useLayoutEffect(() => { seen.push(shown); });
    return null;
  }
  const view = render(createElement(Probe));
  return { seen, rerender: () => view.rerender(createElement(Probe)) };
}

beforeEach(() => {
  jest.useFakeTimers();
  // 23:30 UTC on the 10th is already the 11th at UTC+14.
  jest.setSystemTime(new Date('2026-03-10T23:30:00Z'));
  zone = 'Pacific/Kiritimati';
  localStorage.clear();
});
afterEach(() => jest.useRealTimers());

describe('calendar today follows the display zone', () => {
  it("shows the zone's date on the first render", () => {
    const { seen } = datesShown();
    expect(seen[0]).toBe('2026-03-11');
  });

  it("moves to the new zone's today when the zone changes", () => {
    const { seen, rerender } = datesShown();
    zone = 'UTC';
    rerender();
    expect(seen.at(-1)).toBe('2026-03-10');
  });
});
