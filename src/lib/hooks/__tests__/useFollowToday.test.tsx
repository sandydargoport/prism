/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { format } from 'date-fns';
import { useFollowToday } from '../useFollowToday';

// The device zone is the display zone here, as on most wall displays.
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

function useCalendar(initial: Date) {
  const [currentDate, setCurrentDate] = useState(initial);
  useFollowToday(currentDate, setCurrentDate, zone);
  return { currentDate, setCurrentDate };
}

describe('useFollowToday', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 8, 28, 23, 59, 30));
  });
  afterEach(() => jest.useRealTimers());

  it('moves a calendar showing today on to the new day at midnight', () => {
    const { result } = renderHook(() => useCalendar(new Date(2026, 8, 28, 23, 59, 30)));
    act(() => { jest.advanceTimersByTime(60_000); });
    expect(format(result.current.currentDate, 'yyyy-MM-dd')).toBe('2026-09-29');
  });

  it('leaves a calendar the user moved elsewhere where it is', () => {
    const { result } = renderHook(() => useCalendar(new Date(2026, 8, 28, 23, 59, 30)));
    act(() => { result.current.setCurrentDate(new Date(2026, 9, 15)); });
    act(() => { jest.advanceTimersByTime(60_000); });
    expect(format(result.current.currentDate, 'yyyy-MM-dd')).toBe('2026-10-15');
  });
});
