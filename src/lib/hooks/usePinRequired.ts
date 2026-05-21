'use client';

import { useState, useEffect, useCallback } from 'react';

const CACHE_KEY = 'prism:require-pin';
const SETTINGS_KEY = 'security.requirePin';

function readCached(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached === null ? true : JSON.parse(cached);
  } catch { return true; }
}

export function usePinRequired() {
  const [pinRequired, setPinRequiredState] = useState<boolean>(readCached);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.settings && typeof data.settings[SETTINGS_KEY] === 'boolean') {
          const val: boolean = data.settings[SETTINGS_KEY];
          setPinRequiredState(val);
          localStorage.setItem(CACHE_KEY, JSON.stringify(val));
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const setPinRequired = useCallback(async (value: boolean) => {
    setPinRequiredState(value);
    localStorage.setItem(CACHE_KEY, JSON.stringify(value));
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: SETTINGS_KEY, value }),
      });
    } catch { /* ignore */ }
  }, []);

  return { pinRequired, setPinRequired, loaded };
}
