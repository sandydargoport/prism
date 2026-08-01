import { parseISO, getDay, differenceInCalendarDays } from 'date-fns';
import { mealDate } from '../mealDate';
import { DAYS_OF_WEEK } from '@/lib/constants/days';

describe('mealDate', () => {
  // Anchors that fall on different weekdays (Sunday-start, Monday-start, and an
  // arbitrary mid-week date) — the derived date must be correct regardless.
  const anchors = ['2026-07-26', '2026-07-27', '2026-03-04'];

  for (const weekOf of anchors) {
    for (const day of DAYS_OF_WEEK) {
      it(`${weekOf} + ${day} → a ${day} inside [weekOf, weekOf+6]`, () => {
        const result = mealDate(weekOf, day);
        const d = parseISO(result);
        // The result really is the requested weekday...
        expect(DAYS_OF_WEEK[getDay(d)]).toBe(day);
        // ...and it lives within the 7-day window starting at weekOf.
        const offset = differenceInCalendarDays(d, parseISO(weekOf));
        expect(offset).toBeGreaterThanOrEqual(0);
        expect(offset).toBeLessThanOrEqual(6);
      });
    }
  }

  it('is stable: the same day resolves identically whatever the anchor weekday', () => {
    // Wed 2026-07-29 is reachable from the Sunday-anchored week (Jul 26) and the
    // Monday-anchored week (Jul 27) that both contain it.
    expect(mealDate('2026-07-26', 'wednesday')).toBe('2026-07-29');
    expect(mealDate('2026-07-27', 'wednesday')).toBe('2026-07-29');
  });
});
