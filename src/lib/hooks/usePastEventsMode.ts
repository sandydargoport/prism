'use client';

import { useCallback, useEffect } from 'react';
import { useHydrated, useStoredString, writeStored } from './useStoredValue';
import {
  DEFAULT_PAST_EVENTS_MODE,
  PAST_EVENTS_SETTING_KEY,
  isPastEventsMode,
  type PastEventsMode,
} from '@/lib/utils/pastEvents';

// localStorage copy so the first paint already has the household's choice
// (no flash of ended events before the settings fetch lands).
const CACHE_KEY = 'prism:calendar-past-events';

// One settings fetch per page load, however many calendars are mounted: a
// dashboard and its screensaver can each have one, and the agenda remounts on
// every view switch.
let synced: Promise<void> | null = null;

function syncFromDatabase(): Promise<void> {
  synced ??= fetch('/api/settings')
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const value = data?.settings?.[PAST_EVENTS_SETTING_KEY];
      if (isPastEventsMode(value)) writeStored(CACHE_KEY, value);
    })
    .catch(() => {});
  return synced;
}

/** Test seam: forget that this page load already synced. */
export function resetPastEventsSync(): void {
  synced = null;
}

export function usePastEventsMode(): {
  mode: PastEventsMode;
  loaded: boolean;
  setMode: (mode: PastEventsMode) => void;
} {
  const raw = useStoredString(CACHE_KEY);
  const mode = isPastEventsMode(raw) ? raw : DEFAULT_PAST_EVENTS_MODE;
  const loaded = useHydrated();

  useEffect(() => {
    void syncFromDatabase();
  }, []);

  const setMode = useCallback((next: PastEventsMode) => {
    writeStored(CACHE_KEY, next);
    // Needs the settings permission; a display-only session keeps the local
    // value if the PATCH is refused, as the other calendar preferences do.
    fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: PAST_EVENTS_SETTING_KEY, value: next }),
    }).catch(() => {});
  }, []);

  return { mode, loaded, setMode };
}
