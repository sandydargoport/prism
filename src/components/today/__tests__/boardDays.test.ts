/**
 * The Calendar layout's days (#931).
 */
import { boardDays } from '../CalendarBoard';

const thu = new Date(2026, 10, 5); // Thursday 5 November 2026

describe('boardDays', () => {
  it('shows a rolling week from today, and whole weeks either side', () => {
    expect(boardDays(thu, 'week', 0, 0).map((d) => d.getDate())).toEqual([5, 6, 7, 8, 9, 10, 11]);
    expect(boardDays(thu, 'week', 1, 0)[0]!.getDate()).toBe(12);
    expect(boardDays(thu, 'week', -1, 0)[0]!.getDate()).toBe(29);
  });
  it('shows the month in whole weeks from the week start, without a spare last week', () => {
    const sunday = boardDays(thu, 'month', 0, 0);
    expect(sunday[0]!.getDate()).toBe(1); // 1 November 2026 is a Sunday
    expect(sunday).toHaveLength(35);
    const monday = boardDays(thu, 'month', 0, 1);
    expect(monday[0]!.getMonth()).toBe(9); // starts in late October
    expect(monday[0]!.getDay()).toBe(1);
  });
});
