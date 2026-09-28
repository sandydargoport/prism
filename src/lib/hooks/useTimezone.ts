'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'prism:timezone';
export const DISPLAY_TIMEZONE_MODE_KEY = 'prism:display-timezone-mode';
const TIMEZONE_CHANGED_EVENT = 'prism:timezone-changed';

/** The browser's own IANA timezone, e.g. "America/Chicago". Safe fallback. */
export function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * The display zone as this device last knew it, read synchronously from its
 * cache: the device zone when the display is set to follow the device,
 * otherwise the cached household zone. For code that cannot use
 * useTimeFormat, which is only available below TimeFormatProvider.
 */
export function readStoredDisplayTimezone(): string {
  const device = detectBrowserTimezone();
  try {
    if (localStorage.getItem(DISPLAY_TIMEZONE_MODE_KEY) === 'device') return device;
    return localStorage.getItem(STORAGE_KEY) || device;
  } catch {
    return device;
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
  setTimezone: (value: string) => Promise<void>;
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
    window.dispatchEvent(new CustomEvent(TIMEZONE_CHANGED_EVENT, { detail: newValue }));
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
