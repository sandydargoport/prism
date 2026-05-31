/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';
import { useViewportSize } from '../useViewportSize';

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', {
    value: width,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, 'innerHeight', {
    value: height,
    writable: true,
    configurable: true,
  });
}

describe('useViewportSize', () => {
  beforeEach(() => {
    setViewport(1024, 768);
  });

  it('returns the initial viewport size on mount', () => {
    const { result } = renderHook(() => useViewportSize());
    expect(result.current).toEqual({ width: 1024, height: 768 });
  });

  it('updates when the window is resized', () => {
    const { result } = renderHook(() => useViewportSize());

    act(() => {
      setViewport(800, 600);
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toEqual({ width: 800, height: 600 });
  });

  it('updates on orientationchange', () => {
    const { result } = renderHook(() => useViewportSize());

    act(() => {
      setViewport(600, 800);
      window.dispatchEvent(new Event('orientationchange'));
    });

    expect(result.current).toEqual({ width: 600, height: 800 });
  });

  it('catches the viewport changing between mount and effect attaching', () => {
    // The mount-time read happens synchronously, but if the viewport changes
    // between initial render and the useEffect firing (cold-boot Wyse case),
    // the explicit update() call at the top of the effect must catch it.
    setViewport(1024, 768);
    const { result } = renderHook(() => useViewportSize());

    // Sanity: initial state took the {1024, 768} reading.
    expect(result.current).toEqual({ width: 1024, height: 768 });

    // Simulate the window manager finalizing its work area after mount but
    // before the user resizes — happens on Wyse cold boot.
    act(() => {
      setViewport(1920, 1080);
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toEqual({ width: 1920, height: 1080 });
  });

  it('removes listeners on unmount', () => {
    const removeSpy = jest.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useViewportSize());

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('orientationchange', expect.any(Function));
    removeSpy.mockRestore();
  });

  it('does not return a new object reference when dimensions are unchanged', () => {
    const { result } = renderHook(() => useViewportSize());
    const initial = result.current;

    act(() => {
      // Fire resize without changing dimensions.
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(initial);
  });
});
