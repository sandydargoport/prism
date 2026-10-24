/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';
import { useHiddenHours } from '../useHiddenHours';

const STORAGE_KEY = 'prism:calendar-hidden-hours';

// useHiddenHours now reconciles against /api/settings; jsdom has no global
// fetch, so stub it to an empty-settings response (the DB reconcile becomes a
// no-op and the localStorage-cache behavior these tests assert is preserved).
beforeAll(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ settings: {} }) }),
  ) as unknown as typeof fetch;
});
afterAll(() => {
  delete (global as { fetch?: unknown }).fetch;
});

beforeEach(() => {
  localStorage.clear();
  window.dispatchEvent(new StorageEvent('storage', { key: null }));
});

describe('useHiddenHours', () => {
  it('every mounted copy follows a change made through another', () => {
    // The week view and the side-by-side day view each mount the hook.
    const week = renderHook(() => useHiddenHours());
    const day = renderHook(() => useHiddenHours());

    act(() => week.result.current.toggleHidden());
    expect(day.result.current.settings.enabled).toBe(true);
  });

  it('the database value replaces the cached one', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ startHour: 1, endHour: 5 }));
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ settings: { calendarHiddenHours: { startHour: 22, endHour: 7 } } }),
      }),
    );
    const { result } = renderHook(() => useHiddenHours());
    expect(result.current.settings.startHour).toBe(1);
    await act(async () => {});
    expect(result.current.settings.startHour).toBe(22);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).endHour).toBe(7);
  });

  it('returns default settings on first use', () => {
    const { result } = renderHook(() => useHiddenHours());

    expect(result.current.settings).toEqual({
      mode: 'manual',
      startHour: 0,
      endHour: 6,
      bufferHours: 1,
      enabled: false,
    });
    expect(result.current.loaded).toBe(true);
  });

  it('loads settings from localStorage', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      mode: 'auto-fit',
      startHour: 22,
      endHour: 6,
      bufferHours: 2,
      enabled: true,
    }));

    const { result } = renderHook(() => useHiddenHours());

    expect(result.current.settings.startHour).toBe(22);
    expect(result.current.settings.endHour).toBe(6);
    expect(result.current.settings.bufferHours).toBe(2);
    expect(result.current.settings.mode).toBe('auto-fit');
    expect(result.current.settings.enabled).toBe(true);
  });

  it('falls back to defaults for corrupted localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json{{{');

    const { result } = renderHook(() => useHiddenHours());

    expect(result.current.settings).toEqual({
      mode: 'manual',
      startHour: 0,
      endHour: 6,
      bufferHours: 1,
      enabled: false,
    });
  });

  it('toggleHidden toggles enabled state and persists', () => {
    const { result } = renderHook(() => useHiddenHours());

    expect(result.current.settings.enabled).toBe(false);

    act(() => result.current.toggleHidden());
    expect(result.current.settings.enabled).toBe(true);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.enabled).toBe(true);

    act(() => result.current.toggleHidden());
    expect(result.current.settings.enabled).toBe(false);
  });

  it('setTimeRange updates start and end hours', () => {
    const { result } = renderHook(() => useHiddenHours());

    act(() => result.current.setTimeRange(22, 7));

    expect(result.current.settings.startHour).toBe(22);
    expect(result.current.settings.endHour).toBe(7);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.startHour).toBe(22);
    expect(stored.endHour).toBe(7);
  });

  describe('getVisibleHours', () => {
    it('returns all 24 hours when disabled', () => {
      const { result } = renderHook(() => useHiddenHours());

      const hours = result.current.getVisibleHours();
      expect(hours).toHaveLength(24);
      expect(hours[0]).toBe(0);
      expect(hours[23]).toBe(23);
    });

    it('hides contiguous range (0-6) when enabled', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        startHour: 0,
        endHour: 6,
        enabled: true,
      }));

      const { result } = renderHook(() => useHiddenHours());

      const hours = result.current.getVisibleHours();
      expect(hours).toHaveLength(18); // 24 - 6
      expect(hours[0]).toBe(6);
      expect(hours[hours.length - 1]).toBe(23);
      expect(hours).not.toContain(0);
      expect(hours).not.toContain(5);
    });

    it('handles wrap-around range (22:00 to 6:00)', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        startHour: 22,
        endHour: 6,
        enabled: true,
      }));

      const { result } = renderHook(() => useHiddenHours());

      const hours = result.current.getVisibleHours();
      // Visible: 6-21 (16 hours)
      expect(hours).toHaveLength(16);
      expect(hours[0]).toBe(6);
      expect(hours[hours.length - 1]).toBe(21);
      expect(hours).not.toContain(22);
      expect(hours).not.toContain(23);
      expect(hours).not.toContain(0);
      expect(hours).not.toContain(5);
    });

    it('hides single hour when start == end - 1', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        startHour: 12,
        endHour: 13,
        enabled: true,
      }));

      const { result } = renderHook(() => useHiddenHours());

      const hours = result.current.getVisibleHours();
      expect(hours).toHaveLength(23);
      expect(hours).not.toContain(12);
      expect(hours).toContain(13);
    });
  });
});
