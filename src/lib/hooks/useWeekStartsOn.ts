'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'prism:week-starts-on';

/**
 * Returns the user's preferred first day of the week.
 * 0 = Sunday, 1 = Monday.
 * Reads from settings API on mount, caches in localStorage.
 */
export function useWeekStartsOn(): {
  weekStartsOn: 0 | 1;
  setWeekStartsOn: (value: 0 | 1) => Promise<void>;
  loading: boolean;
} {
  const [value, setValue] = useState<0 | 1>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === '0' || saved === '1') return Number(saved) as 0 | 1;
    }
    return 0; // Default Sunday
  });
  const [loading, setLoading] = useState(true);

  // Fetch from settings API on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          const v = data.settings?.weekStartsOn;
          if (v === '1' || v === 1) {
            setValue(1);
            localStorage.setItem(STORAGE_KEY, '1');
          } else if (v === '0' || v === 0 || v !== undefined) {
            setValue(0);
            localStorage.setItem(STORAGE_KEY, '0');
          }
        }
      } catch { /* use cached/default */ }
      setLoading(false);
    }
    load();
  }, []);

  const setWeekStartsOn = useCallback(async (newValue: 0 | 1) => {
    setValue(newValue);
    localStorage.setItem(STORAGE_KEY, String(newValue));
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'weekStartsOn', value: String(newValue) }),
      });
    } catch { /* silent */ }
  }, []);

  return { weekStartsOn: value, setWeekStartsOn, loading };
}

/**
 * Read week-starts-on from localStorage synchronously (for non-hook contexts).
 * Falls back to 0 (Sunday).
 */
export function getWeekStartsOn(): 0 | 1 {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === '1') return 1;
  }
  return 0;
}
