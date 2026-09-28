import { calculateNextDue } from '../calculateNextDue';

/**
 * All tests start from a fixed date key: Wednesday, 2026-03-11. The function
 * takes "today" as a key, so the result does not depend on the process zone.
 */
const REF = '2026-03-11';

describe('calculateNextDue', () => {
  // --- daily ---
  it('daily → tomorrow', () => {
    expect(calculateNextDue('daily', null, null, REF)).toBe('2026-03-12');
  });

  // --- weekly ---
  it('weekly (default) → next Sunday', () => {
    // 2026-03-11 is Wednesday, next Sunday is 2026-03-15
    expect(calculateNextDue('weekly', null, null, REF)).toBe('2026-03-15');
  });

  it('weekly with startDay=1 → next Monday', () => {
    // 2026-03-11 is Wednesday, next Monday is 2026-03-16
    expect(calculateNextDue('weekly', null, '1', REF)).toBe('2026-03-16');
  });

  it('weekly with startDay=3 → next Wednesday', () => {
    // 2026-03-11 is Wednesday, next Wednesday is 2026-03-18
    expect(calculateNextDue('weekly', null, '3', REF)).toBe('2026-03-18');
  });

  // --- biweekly ---
  it('biweekly → 2 weeks from next target day', () => {
    // Next Sunday from 2026-03-11 is 2026-03-15, + 1 week = 2026-03-22
    expect(calculateNextDue('biweekly', null, null, REF)).toBe('2026-03-22');
  });

  it('biweekly with startDay=1 → next Monday + 1 week', () => {
    // Next Monday from 2026-03-11 is 2026-03-16, + 1 week = 2026-03-23
    expect(calculateNextDue('biweekly', null, '1', REF)).toBe('2026-03-23');
  });

  // --- monthly ---
  it('monthly (default) → next 1st', () => {
    // 2026-03-11 is past the 1st, so next month's 1st → 2026-04-01
    expect(calculateNextDue('monthly', null, null, REF)).toBe('2026-04-01');
  });

  it('monthly with startDay=15 → this month (day not yet passed)', () => {
    // 2026-03-11, target day 15 hasn't passed → 2026-03-15
    expect(calculateNextDue('monthly', null, '15', REF)).toBe('2026-03-15');
  });

  it('monthly with startDay=5 → next month (day already passed)', () => {
    // 2026-03-11, target day 5 has passed → 2026-04-05
    expect(calculateNextDue('monthly', null, '5', REF)).toBe('2026-04-05');
  });

  // --- quarterly ---
  it('quarterly → 3 months from start of month', () => {
    // Start of 2026-03 + 3 months = 2026-06-01, default day 1
    expect(calculateNextDue('quarterly', null, null, REF)).toBe('2026-06-01');
  });

  it('quarterly with startDay=15 → 3 months + day 15', () => {
    expect(calculateNextDue('quarterly', null, '15', REF)).toBe('2026-06-15');
  });

  // --- semi-annually ---
  it('semi-annually → 6 months from start of month', () => {
    // Start of 2026-03 + 6 months = 2026-09-01, default day 1
    expect(calculateNextDue('semi-annually', null, null, REF)).toBe('2026-09-01');
  });

  it('semi-annually with startDay=10 → 6 months + day 10', () => {
    expect(calculateNextDue('semi-annually', null, '10', REF)).toBe('2026-09-10');
  });

  // --- annually ---
  it('annually (no startDay) → same date next year if already passed today', () => {
    // 2026-03-11 is "today", same date = 2026-03-11 which is not after today,
    // so it goes to next year: 2027-03-11
    expect(calculateNextDue('annually', null, null, REF)).toBe('2027-03-11');
  });

  it('annually with startDay MM-DD (future this year)', () => {
    // 2026-03-11 → target 06-15 is still ahead in 2026
    expect(calculateNextDue('annually', null, '06-15', REF)).toBe('2026-06-15');
  });

  it('annually with startDay MM-DD (past this year)', () => {
    // 2026-03-11 → target 01-10 already passed → 2027-01-10
    expect(calculateNextDue('annually', null, '01-10', REF)).toBe('2027-01-10');
  });

  // --- custom ---
  it('custom with interval → today + N days', () => {
    expect(calculateNextDue('custom', 7, null, REF)).toBe('2026-03-18');
  });

  it('custom with interval=14 → today + 14 days', () => {
    expect(calculateNextDue('custom', 14, null, REF)).toBe('2026-03-25');
  });

  it('custom without interval → tomorrow (fallback)', () => {
    expect(calculateNextDue('custom', null, null, REF)).toBe('2026-03-12');
  });

  // --- edge cases ---
  it('monthly clamps startDay to max 28', () => {
    // startDay=31 should be clamped to 28
    expect(calculateNextDue('monthly', null, '31', REF)).toBe('2026-03-28');
  });

  it('monthly clamps startDay to min 1', () => {
    // startDay=0 should be clamped to 1 → next month since 1 < 11 is false
    expect(calculateNextDue('monthly', null, '0', REF)).toBe('2026-04-01');
  });

  it('unknown frequency falls back to tomorrow', () => {
    // Cast to bypass TS check
    expect(calculateNextDue('unknown' as 'daily', null, null, REF)).toBe('2026-03-12');
  });

  // --- the day comes from the key, not the clock ---
  it('crosses a DST change by calendar days', () => {
    // US clocks spring forward on 2026-03-08; still exactly one day later.
    expect(calculateNextDue('daily', null, null, '2026-03-07')).toBe('2026-03-08');
    expect(calculateNextDue('custom', 7, null, '2026-03-05')).toBe('2026-03-12');
  });

  it('rejects a key that is not a date', () => {
    expect(() => calculateNextDue('daily', null, null, '2026-02-30')).toThrow(RangeError);
  });
});
