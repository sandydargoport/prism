/**
 * @jest-environment jsdom
 */

/**
 * Tests for useIdleDetection hook using renderHook.
 *
 * Tests idle state after timeout, activity resets, forceIdle,
 * custom event handling, and cleanup on unmount.
 */

import { renderHook, act } from '@testing-library/react';
import { useIdleDetection } from '../useIdleDetection';

// Suppress fetch calls from the away mode auto-check
beforeAll(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ enabled: false }),
  });

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

describe('useIdleDetection', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns isIdle=false initially', () => {
    const { result } = renderHook(() => useIdleDetection(60));
    expect(result.current.isIdle).toBe(false);
  });

  it('returns a forceIdle function', () => {
    const { result } = renderHook(() => useIdleDetection(60));
    expect(typeof result.current.forceIdle).toBe('function');
  });

  it('becomes idle after timeout elapses', () => {
    const { result } = renderHook(() => useIdleDetection(5)); // 5 seconds

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(result.current.isIdle).toBe(true);
  });

  it('does not become idle before timeout elapses', () => {
    const { result } = renderHook(() => useIdleDetection(10));

    act(() => {
      jest.advanceTimersByTime(9000); // 9 of 10 seconds
    });

    expect(result.current.isIdle).toBe(false);
  });

  it('resets timer on mousemove so idle is delayed', () => {
    const { result } = renderHook(() => useIdleDetection(5));

    // Advance 4 seconds (almost idle)
    act(() => {
      jest.advanceTimersByTime(4000);
    });
    expect(result.current.isIdle).toBe(false);

    // Simulate mousemove to reset timer
    act(() => {
      window.dispatchEvent(new Event('mousemove'));
    });

    // Advance another 4 seconds — shouldn't be idle yet (timer was reset)
    act(() => {
      jest.advanceTimersByTime(4000);
    });
    expect(result.current.isIdle).toBe(false);

    // Advance 1 more second — now should be idle (5s after reset)
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.isIdle).toBe(true);
  });

  it('forceIdle immediately activates idle state', () => {
    const { result } = renderHook(() => useIdleDetection(60));
    expect(result.current.isIdle).toBe(false);

    act(() => {
      result.current.forceIdle();
    });

    expect(result.current.isIdle).toBe(true);
  });

  it('does not activate idle when timeout is 0 (disabled)', () => {
    const { result } = renderHook(() => useIdleDetection(0));

    act(() => {
      jest.advanceTimersByTime(300000); // 5 minutes
    });

    expect(result.current.isIdle).toBe(false);
  });

  it('uses stored timeout from localStorage when no initialTimeout', () => {
    localStorage.setItem('prism-screensaver-timeout', '3');

    const { result } = renderHook(() => useIdleDetection());

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.isIdle).toBe(true);
  });

  it('defaults to disabled when no stored value and no initialTimeout', () => {
    const { result } = renderHook(() => useIdleDetection());

    act(() => {
      jest.advanceTimersByTime(300000);
    });
    expect(result.current.isIdle).toBe(false);
  });

  it('dismisses idle on keydown after becoming idle', () => {
    const { result } = renderHook(() => useIdleDetection(2));

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current.isIdle).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('keydown'));
    });

    expect(result.current.isIdle).toBe(false);
  });

  it('responds to prism:screensaver custom event by forcing idle', () => {
    const { result } = renderHook(() => useIdleDetection(60));

    act(() => {
      window.dispatchEvent(new Event('prism:screensaver'));
    });

    expect(result.current.isIdle).toBe(true);
  });

  it('responds to prism:screensaver-timeout-change by updating timeout', () => {
    const { result } = renderHook(() => useIdleDetection(999));

    // Change timeout to 2 seconds via custom event
    act(() => {
      window.dispatchEvent(
        new CustomEvent('prism:screensaver-timeout-change', { detail: 2 })
      );
    });

    // Old timeout (999s) should not apply — new 2s timeout should
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.isIdle).toBe(true);
  });

  it('cleans up event listeners on unmount', () => {
    const removeSpy = jest.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useIdleDetection(60));

    unmount();

    const removedEvents = removeSpy.mock.calls.map((call) => call[0]);
    expect(removedEvents).toContain('mousemove');
    expect(removedEvents).toContain('keydown');
    expect(removedEvents).toContain('touchstart');
    expect(removedEvents).toContain('prism:screensaver');
    expect(removedEvents).toContain('prism:screensaver-timeout-change');

    removeSpy.mockRestore();
  });

  it('forceIdle prevents first dismiss interaction (double-tap protection)', () => {
    const { result } = renderHook(() => useIdleDetection(60));

    // Force idle (simulates clicking the screensaver button)
    act(() => {
      result.current.forceIdle();
    });
    expect(result.current.isIdle).toBe(true);

    // First mousedown should NOT dismiss (it's the mouseup from the button click)
    act(() => {
      window.dispatchEvent(new Event('mousedown'));
    });
    expect(result.current.isIdle).toBe(true);

    // Second interaction should dismiss
    act(() => {
      window.dispatchEvent(new Event('mousedown'));
    });
    expect(result.current.isIdle).toBe(false);
  });
});
