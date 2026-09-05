/**
 * @jest-environment jsdom
 */
/**
 * Two of the setting's values changed meaning when the four transitions landed:
 * 'smoke' used to be a plain opacity fade, and 'dissolve' was an SVG-filter
 * erosion that is now a particle burst. A display set before that change must
 * keep doing what its owner chose — silently switching a wall display to a
 * different effect on an update is the kind of thing nobody reports and
 * everybody notices.
 */
import { renderHook, act } from '@testing-library/react';
import { useScreensaverMotion } from '../useScreensaverMotion';

const KEY = 'prism-screensaver-motion';
const FLAG = 'prism-screensaver-motion-v2';

beforeEach(() => window.localStorage.clear());

describe('screensaver motion setting', () => {
  it('keeps the old "smoke" displays on a plain fade', () => {
    window.localStorage.setItem(KEY, 'smoke');
    const { result } = renderHook(() => useScreensaverMotion());
    expect(result.current.motion).toBe('fade');
    expect(window.localStorage.getItem(KEY)).toBe('fade');
  });

  it('moves the old "dissolve" displays to fireworks', () => {
    window.localStorage.setItem(KEY, 'dissolve');
    const { result } = renderHook(() => useScreensaverMotion());
    expect(result.current.motion).toBe('fireworks');
  });

  it('leaves fill-and-drain alone', () => {
    window.localStorage.setItem(KEY, 'liquid');
    const { result } = renderHook(() => useScreensaverMotion());
    expect(result.current.motion).toBe('liquid');
  });

  it('does not re-migrate once migrated, so smoke can mean smoke again', () => {
    window.localStorage.setItem(KEY, 'smoke');
    window.localStorage.setItem(FLAG, '1');
    const { result } = renderHook(() => useScreensaverMotion());
    expect(result.current.motion).toBe('smoke');
  });

  it('defaults to off, so no display changes character unasked', () => {
    const { result } = renderHook(() => useScreensaverMotion());
    expect(result.current.motion).toBe('off');
  });

  it('ignores a value that means nothing', () => {
    window.localStorage.setItem(KEY, 'sparkles');
    const { result } = renderHook(() => useScreensaverMotion());
    expect(result.current.motion).toBe('off');
  });

  it('accepts every offered choice', () => {
    for (const v of ['off', 'fade', 'smoke', 'liquid', 'fireworks'] as const) {
      const { result } = renderHook(() => useScreensaverMotion());
      act(() => result.current.setMotion(v));
      expect(result.current.motion).toBe(v);
      expect(window.localStorage.getItem(KEY)).toBe(v);
    }
  });
});
