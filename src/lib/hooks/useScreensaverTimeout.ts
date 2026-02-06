'use client';

import { useState, useEffect, useCallback } from 'react';

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
  const [timeout, setTimeoutState] = useState<number>(() => {
    if (typeof window === 'undefined') return DEFAULT_TIMEOUT;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== null ? Number(stored) : DEFAULT_TIMEOUT;
  });

  // Sync with localStorage on mount (for SSR hydration)
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setTimeoutState(Number(stored));
    }
  }, []);

  const setTimeout = useCallback((value: number) => {
    setTimeoutState(value);
    localStorage.setItem(STORAGE_KEY, String(value));
    // Dispatch event so useIdleDetection can react
    window.dispatchEvent(new CustomEvent('prism:screensaver-timeout-change', { detail: value }));
  }, []);

  return { timeout, setTimeout };
}
