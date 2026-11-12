/**
 * The Calendar page fetches a window around the date it shows (#1082), not
 * four years. It must still reach past everything any view draws, so nothing
 * vanishes past a horizon (#250), and stay the same within a quarter, so
 * paging reuses one request.
 */
import { addDays, addMonths, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns';
import { getCalendarWindow, MAX_CALENDAR_EVENTS } from '../calendarRange';

describe('getCalendarWindow', () => {
  it('covers what every view draws, for every day across two years', () => {
    for (let d = new Date(2026, 0, 1); d < new Date(2028, 0, 1); d = addDays(d, 1)) {
      const { start, end } = getCalendarWindow(d);
      // Month grid: from the week the month starts in. Three-month view: to the
      // end of the week the second following month ends in. Agenda: 30 days on.
      const from = startOfWeek(startOfMonth(d), { weekStartsOn: 0 });
      const to = [endOfWeek(endOfMonth(addMonths(d, 2)), { weekStartsOn: 1 }), addDays(d, 31)];
      expect(start <= from).toBe(true);
      for (const t of to) expect(end >= t).toBe(true);
    }
  });

  it('is about eight months, not four years', () => {
    const { start, end } = getCalendarWindow(new Date(2026, 7, 18));
    expect((end.getTime() - start.getTime()) / 86_400_000).toBeLessThan(260);
  });

  it('is the same for every day in a quarter, so paging within it reuses one request', () => {
    const a = getCalendarWindow(new Date(2026, 6, 1));
    const b = getCalendarWindow(new Date(2026, 8, 30));
    expect(a).toEqual(b);
    expect(getCalendarWindow(new Date(2026, 9, 1))).not.toEqual(a);
  });

  it('covers the event that used to disappear in #250 (today + ~2 months)', () => {
    const { start, end } = getCalendarWindow(new Date(2026, 7, 18));
    const event = new Date(2026, 9, 17);
    expect(event >= start && event <= end).toBe(true);
  });

  it('has headroom well above a busy family instance count', () => {
    expect(MAX_CALENDAR_EVENTS).toBeGreaterThanOrEqual(5000);
  });
});
