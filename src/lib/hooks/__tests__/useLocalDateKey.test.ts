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
import { renderHook, act } from '@testing-library/react';
import {
  localDateKey,
  msUntilNextLocalMidnight,
  msUntilNextMidnight,
  useLocalDateKey,
  zonedDateKey,
} from '../useLocalDateKey';

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

describe('in an explicit zone', () => {
  // 01:30Z on 29 Sep is still the 28th in Chicago and already the 29th in Tokyo,
  // whatever zone the test process runs in.
  const instant = new Date('2026-09-29T01:30:00Z');

  it('is that zone\'s date, not the device\'s', () => {
    expect(zonedDateKey('America/Chicago', instant)).toBe('2026-09-28');
    expect(zonedDateKey('Asia/Tokyo', instant)).toBe('2026-09-29');
  });

  it('falls back to the device date for an unknown zone', () => {
    expect(zonedDateKey('Not/AZone', instant)).toBe(localDateKey(instant));
    expect(zonedDateKey(undefined, instant)).toBe(localDateKey(instant));
  });

  it('counts down to that zone\'s midnight', () => {
    // Chicago is 20:30 CDT, so midnight is 3.5 hours (plus the second of slack) away.
    expect(msUntilNextMidnight('America/Chicago', instant)).toBe(3.5 * 60 * 60 * 1000 + 1000);
    // Tokyo is 10:30 JST: 13.5 hours.
    expect(msUntilNextMidnight('Asia/Tokyo', instant)).toBe(13.5 * 60 * 60 * 1000 + 1000);
  });

  it('lands on the next day on a 25-hour fall-back day', () => {
    const now = new Date('2026-11-01T05:00:00Z'); // 00:00 CDT, the day is 25h long
    const next = new Date(now.getTime() + msUntilNextMidnight('America/Chicago', now));
    expect(zonedDateKey('America/Chicago', next)).toBe('2026-11-02');
  });

  it('lands on the next day on a 23-hour spring-forward day', () => {
    const now = new Date('2026-03-08T06:00:00Z'); // 00:00 CST, the day is 23h long
    const next = new Date(now.getTime() + msUntilNextMidnight('America/Chicago', now));
    expect(zonedDateKey('America/Chicago', next)).toBe('2026-03-09');
  });
});

describe('useLocalDateKey with a zone', () => {
  afterEach(() => jest.useRealTimers());

  it('rolls over at that zone\'s midnight', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-29T04:59:00Z')); // 23:59 CDT on the 28th
    const { result } = renderHook(() => useLocalDateKey('America/Chicago'));
    expect(result.current).toBe('2026-09-28');
    act(() => { jest.advanceTimersByTime(2 * 60 * 1000); });
    expect(result.current).toBe('2026-09-29');
  });

  it('follows a change of zone', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-29T01:30:00Z'));
    const { result, rerender } = renderHook(({ zone }) => useLocalDateKey(zone), {
      initialProps: { zone: 'America/Chicago' },
    });
    expect(result.current).toBe('2026-09-28');
    rerender({ zone: 'Asia/Tokyo' });
    expect(result.current).toBe('2026-09-29');
  });
});
