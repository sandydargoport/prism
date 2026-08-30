/**
 * @jest-environment jsdom
 */
/**
 * Rolling the calendar's request window over at midnight.
 *
 * Several hooks compute a window from `new Date()` inside a memo whose deps
 * are constants, so it is fixed at mount. A wall display is never reloaded, so
 * "today" on screen quietly stops being today — and nobody notices, because
 * the dashboard still looks like a dashboard.
 */
import { localDateKey, msUntilNextLocalMidnight } from '../useLocalDateKey';

describe('localDateKey', () => {
  it('changes when the local date changes', () => {
    const before = localDateKey(new Date(2026, 7, 30, 23, 59, 59));
    const after = localDateKey(new Date(2026, 7, 31, 0, 0, 1));
    expect(before).not.toBe(after);
  });

  it('does not change during a day, so it cannot cause a stray refetch', () => {
    expect(localDateKey(new Date(2026, 7, 30, 0, 0, 1)))
      .toBe(localDateKey(new Date(2026, 7, 30, 23, 59, 59)));
  });

  it('uses local components, not UTC', () => {
    // toISOString() would roll over at UTC midnight, which is the wrong moment
    // for anyone not on UTC — the calendar would flip mid-evening or mid-morning.
    const evening = new Date(2026, 7, 30, 20, 0, 0);
    expect(localDateKey(evening)).toBe('2026-08-30');
  });

  it('pads month and day so the key sorts and compares predictably', () => {
    expect(localDateKey(new Date(2026, 0, 5, 12, 0, 0))).toBe('2026-01-05');
  });
});

describe('msUntilNextLocalMidnight', () => {
  it('is a little over a day when it has just gone midnight', () => {
    const ms = msUntilNextLocalMidnight(new Date(2026, 7, 30, 0, 0, 2));
    expect(ms).toBeGreaterThan(23.9 * 60 * 60 * 1000);
    expect(ms).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 2000);
  });

  it('is small just before midnight', () => {
    const ms = msUntilNextLocalMidnight(new Date(2026, 7, 30, 23, 59, 50));
    expect(ms).toBeLessThan(15_000);
  });

  it('never returns zero or negative, so the timer cannot spin', () => {
    // A timer scheduled for 0ms that recomputes to 0ms again is a busy loop on
    // a device that is never closed.
    expect(msUntilNextLocalMidnight(new Date(2026, 7, 30, 23, 59, 59, 999)))
      .toBeGreaterThanOrEqual(1000);
  });

  it('lands on the next day rather than skipping one, across a month boundary', () => {
    const now = new Date(2026, 7, 31, 22, 0, 0);
    const next = new Date(now.getTime() + msUntilNextLocalMidnight(now));
    expect(localDateKey(next)).toBe('2026-09-01');
  });

  it('lands correctly across a leap day', () => {
    const now = new Date(2028, 1, 28, 22, 0, 0);
    const next = new Date(now.getTime() + msUntilNextLocalMidnight(now));
    expect(localDateKey(next)).toBe('2028-02-29');
  });
});
