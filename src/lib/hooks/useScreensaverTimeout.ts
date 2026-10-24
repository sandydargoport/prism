'use client';

import { useCallback } from 'react';
import { useStoredString, writeStored } from './useStoredValue';

const STORAGE_KEY = 'prism-screensaver-timeout';
const DEFAULT_TIMEOUT = 120; // 2 minutes in seconds

export const SCREENSAVER_TIMEOUT_OPTIONS = [
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 120, label: '2 minutes' },
  { value: 600, label: '10 minutes' },
  { value: 3600, label: '1 hour' },
  { value: 0, label: 'Never' },
] as const;

export function useScreensaverTimeout() {
  const stored = useStoredString(STORAGE_KEY);
  const timeout = stored !== null ? Number(stored) : DEFAULT_TIMEOUT;

  const setTimeout = useCallback((value: number) => {
    writeStored(STORAGE_KEY, String(value));
    // Dispatch event so useIdleDetection can react
    window.dispatchEvent(new CustomEvent('prism:screensaver-timeout-change', { detail: value }));
  }, []);

  return { timeout, setTimeout };
}
