'use client';

import { useSyncExternalStore } from 'react';
import { usePerformanceModeOn } from './usePerformanceMode';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {};
  const mq = window.matchMedia(REDUCED_MOTION);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function readReducedMotion(): boolean {
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(REDUCED_MOTION).matches;
}

/**
 * Returns true when motion-heavy effects (full-screen celebrations, plane
 * fly-by, confetti) should be skipped. Two reasons fold into one signal:
 *   - The OS-level `prefers-reduced-motion` accessibility preference is set.
 *   - Performance Mode is enabled (manual or auto-detected).
 *
 * Follows both as they change. False while hydrating, as on the server.
 */
export function useShouldSkipMotion(): boolean {
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, () => false);
  return usePerformanceModeOn() || reducedMotion;
}
