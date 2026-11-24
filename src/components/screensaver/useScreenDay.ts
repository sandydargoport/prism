'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useStoredString, writeStored } from '@/lib/hooks/useStoredValue';
import { sharedGet } from '@/lib/utils/sharedGet';
import {
  DEFAULT_SCREEN_DAY,
  effectiveScreenDay,
  HOUSEHOLD_DAY_SETTING,
  LEGACY_DIM_KEY,
  parseHouseholdDay,
  SCREEN_DAY_KEY,
  serializeScreenDay,
  type ScreenDay,
} from '@/lib/screenDay';

/**
 * This screen's day (#1345): its idle look by day and at night, when night is
 * and how much darker. Read from the screen's own key; a browser that has
 * none goes by the household's starting day, read once per page.
 */

let household: ScreenDay = DEFAULT_SCREEN_DAY;
let requested = false;
const listeners = new Set<() => void>();

function setHousehold(next: ScreenDay): void {
  household = next;
  for (const listener of listeners) listener();
}

function loadHousehold(): void {
  if (requested || typeof fetch === 'undefined') return;
  requested = true;
  Promise.resolve()
    .then(() => sharedGet('/api/settings'))
    .then((r) => (r?.ok ? r.json() : null))
    .then((data) => {
      const value = data?.settings?.[HOUSEHOLD_DAY_SETTING];
      if (value !== undefined) setHousehold(parseHouseholdDay(value));
    })
    .catch(() => { /* the default until the next page */ });
}

/** For tests: forget the household's day and read it again next time. */
export function resetHouseholdDay(): void {
  household = DEFAULT_SCREEN_DAY;
  requested = false;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The household's starting day, the default until it has been read. */
export function useHouseholdDay(): ScreenDay {
  const own = useStoredString(SCREEN_DAY_KEY);
  // A browser with a day of its own never needs it.
  useEffect(() => { if (own === null) loadHousehold(); }, [own]);
  return useSyncExternalStore(subscribe, () => household, () => DEFAULT_SCREEN_DAY);
}

/** Write this screen's day. On a frame editing another screen it lands in that screen's settings. */
export function setScreenDay(day: ScreenDay): void {
  writeStored(SCREEN_DAY_KEY, serializeScreenDay(day));
}

export function useScreenDay(): { day: ScreenDay; setDay: (day: ScreenDay) => void } {
  const own = useStoredString(SCREEN_DAY_KEY);
  const legacyDim = useStoredString(LEGACY_DIM_KEY);
  const fromHousehold = useHouseholdDay();
  const day = useMemo(() => effectiveScreenDay(own, fromHousehold, legacyDim), [own, fromHousehold, legacyDim]);
  return { day, setDay: setScreenDay };
}
