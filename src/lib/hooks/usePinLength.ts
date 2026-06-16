'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DEFAULT_PIN_LENGTH,
  MIN_PIN_LENGTH,
  MAX_PIN_LENGTH,
  PIN_LENGTH_SETTING_KEY,
} from '@/lib/constants';

const STORAGE_KEY = 'prism:pin-length';

function clamp(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_PIN_LENGTH;
  return Math.min(MAX_PIN_LENGTH, Math.max(MIN_PIN_LENGTH, Math.round(n)));
}

/**
 * Family-wide PIN length (uniform for all members, like an iPhone passcode).
 * Reads from the settings API on mount, caches in localStorage so the PIN pads
 * render the right number of slots immediately on next load. Defaults to 4.
 */
export function usePinLength(): {
  pinLength: number;
  setPinLength: (value: number) => Promise<void>;
  loading: boolean;
} {
  const [value, setValue] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = Number(localStorage.getItem(STORAGE_KEY));
      if (saved) return clamp(saved);
    }
    return DEFAULT_PIN_LENGTH;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          const raw = data.settings?.[PIN_LENGTH_SETTING_KEY];
          if (raw !== undefined && raw !== null && raw !== '') {
            const next = clamp(Number(raw));
            setValue(next);
            localStorage.setItem(STORAGE_KEY, String(next));
          }
        }
      } catch {
        /* use cached/default */
      }
      setLoading(false);
    }
    load();
  }, []);

  const setPinLength = useCallback(async (newValue: number) => {
    const next = clamp(newValue);
    setValue(next);
    localStorage.setItem(STORAGE_KEY, String(next));
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: PIN_LENGTH_SETTING_KEY, value: String(next) }),
    });
  }, []);

  return { pinLength: value, setPinLength, loading };
}

/**
 * Synchronous read from localStorage for non-hook contexts. Falls back to the
 * default; the authoritative value still comes from the settings API via the hook.
 */
export function getPinLength(): number {
  if (typeof window !== 'undefined') {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    if (saved) return clamp(saved);
  }
  return DEFAULT_PIN_LENGTH;
}
