'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'prism:timezone';

/** The browser's own IANA timezone, e.g. "America/Chicago". Safe fallback. */
export function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * The household's IANA timezone. Persisted in the `timezone` setting; defaults
 * to the browser's detected zone (more accurate than a ZIP lookup) until the
 * user picks one. Mirrors useWeekStartsOn: settings API is the source of truth,
 * localStorage is a synchronous cache.
 */
export function useTimezone(): {
  timezone: string;
  setTimezone: (value: string) => void;
  loading: boolean;
} {
  const [value, setValue] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return saved;
    }
    return detectBrowserTimezone();
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          const v = data.settings?.timezone;
          if (typeof v === 'string' && v) {
            setValue(v);
            localStorage.setItem(STORAGE_KEY, v);
          }
        }
      } catch {
        /* use cached/detected */
      }
      setLoading(false);
    }
    load();
  }, []);

  const setTimezone = useCallback(async (newValue: string) => {
    setValue(newValue);
    localStorage.setItem(STORAGE_KEY, newValue);
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'timezone', value: newValue }),
      });
    } catch {
      /* silent */
    }
  }, []);

  return { timezone: value, setTimezone, loading };
}

/** Read the household timezone synchronously (non-hook contexts). */
export function getTimezone(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;
  }
  return detectBrowserTimezone();
}
