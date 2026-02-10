'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'prism-away-mode-timeout';
const DEFAULT_TIMEOUT = 0; // 0 = disabled

/**
 * Get stored away mode timeout (in hours)
 * Returns 0 if disabled
 */
function getStoredTimeout(): number {
  if (typeof window === 'undefined') return DEFAULT_TIMEOUT;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored !== null ? Number(stored) : DEFAULT_TIMEOUT;
}

/**
 * Hook to manage away mode auto-activation timeout setting
 * Timeout is in hours (e.g., 24 = 1 day, 48 = 2 days)
 */
export function useAwayModeTimeout() {
  const [timeout, setTimeoutValue] = useState(() => getStoredTimeout());

  const setTimeout = useCallback((hours: number) => {
    setTimeoutValue(hours);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(hours));
      // Dispatch event to notify other components
      window.dispatchEvent(
        new CustomEvent('prism:away-mode-timeout-change', { detail: hours })
      );
    }
  }, []);

  // Listen for changes from other tabs/components
  useEffect(() => {
    const handler = (e: CustomEvent<number>) => {
      setTimeoutValue(e.detail);
    };
    window.addEventListener('prism:away-mode-timeout-change', handler as EventListener);
    return () => window.removeEventListener('prism:away-mode-timeout-change', handler as EventListener);
  }, []);

  return { timeout, setTimeout };
}
