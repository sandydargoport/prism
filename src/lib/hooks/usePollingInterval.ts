'use client';

import { usePerformanceModeOn } from './usePerformanceMode';

/**
 * Stretch factor applied to all polling intervals when performance mode is on.
 * 2.5× turns 120s → 300s and 300s → 750s, materially reducing CPU/network
 * load on weak hardware without making the dashboard feel stale.
 */
export const PERF_MODE_POLL_STRETCH = 2.5;

/**
 * Returns an effective polling interval given a default. When performance
 * mode is on, the interval is stretched by PERF_MODE_POLL_STRETCH. The hook
 * follows the setting as it changes.
 *
 * Pass 0 (or negative) to mean "polling disabled" — that value is returned
 * as-is, never stretched.
 */
export function usePollingInterval(defaultMs: number): number {
  const perfModeOn = usePerformanceModeOn();

  if (defaultMs <= 0) return defaultMs;
  return perfModeOn ? Math.round(defaultMs * PERF_MODE_POLL_STRETCH) : defaultMs;
}
