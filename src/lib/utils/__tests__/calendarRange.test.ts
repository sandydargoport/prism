/**
 * Regression test for #250: the calendar fetch window must reach far enough
 * past today that events a couple months+ out don't vanish from the views.
 */
import { getFullCalendarRange, MAX_CALENDAR_EVENTS } from '../calendarRange';

describe('getFullCalendarRange', () => {
  it('spans Jan 1 of last year through Dec 31 two years out', () => {
    const { start, end } = getFullCalendarRange(new Date(2026, 7, 18)); // 2026-08-18

    expect(start.getFullYear()).toBe(2025);
    expect(start.getMonth()).toBe(0); // January
    expect(start.getDate()).toBe(1);

    expect(end.getFullYear()).toBe(2028);
    expect(end.getMonth()).toBe(11); // December
    expect(end.getDate()).toBe(31);
  });

  it('covers the exact event that used to disappear (today + ~2 months)', () => {
    const today = new Date(2026, 7, 18);
    const { start, end } = getFullCalendarRange(today);
    const oldCutoffEvent = new Date(2026, 9, 17); // 2026-10-17, the reported boundary

    expect(oldCutoffEvent >= start && oldCutoffEvent <= end).toBe(true);
  });

  it('has headroom well above a busy family instance count', () => {
    expect(MAX_CALENDAR_EVENTS).toBeGreaterThanOrEqual(5000);
  });
});
