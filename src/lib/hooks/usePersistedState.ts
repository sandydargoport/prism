'use client';

import { useState, useEffect } from 'react';

/**
 * useState that survives a refresh, stored per browser.
 *
 * The Tasks page reset its grouping and sort on every reload, so on a wall
 * display the view someone deliberately set was gone the next time the page
 * came back. The calendar widget already persists its view this way
 * (`prism-calendar-*` keys); this is the same idea, extracted rather than
 * hand-rolled a third time.
 *
 * For view preferences only. Anything that must survive a browser change, or
 * be shared between the display and a phone, belongs in the database.
 *
 * Reads and writes are guarded: localStorage throws in some contexts (private
 * windows, blocked site data), and a preference is never worth a broken page.
 */
export function usePersistedState<T>(
  key: string,
  initial: T,
  isValid: (v: unknown) => v is T,
): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return initial;
      const parsed = JSON.parse(raw) as unknown;
      // Validated rather than trusted: a stored value can outlive the option
      // that produced it, and a stale one would leave the view in a state the
      // UI no longer offers a way out of.
      return isValid(parsed) ? parsed : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable — the session works, it just will not persist */
    }
  }, [key, value]);

  return [value, setValue];
}

/** Validator for a fixed set of string options. */
export function oneOf<T extends string>(...allowed: readonly T[]) {
  return (v: unknown): v is T => typeof v === 'string' && (allowed as readonly string[]).includes(v);
}

export const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';

/** Written by useIdleDetection on any interaction, across the whole app. */
const LAST_ACTIVITY_KEY = 'prism-last-activity';

/**
 * How long the display must have gone untouched before a narrowing choice is
 * forgotten. Longer than the default screensaver timeout (2 minutes), so
 * returning to a sleeping display gives you the unfiltered list back, while a
 * reload during active use keeps what you picked.
 */
export const IDLE_FORGET_MS = 15 * 60 * 1000;

/** True when the display has been idle long enough to forget a filter. */
export function displayWentIdle(now = Date.now()): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(LAST_ACTIVITY_KEY);
    // No activity ever recorded — treat as fresh rather than stale, so a
    // browser that has never run the screensaver does not lose the filter on
    // every load.
    if (raw === null) return false;
    const last = Number(raw);
    if (!Number.isFinite(last)) return false;
    return now - last > IDLE_FORGET_MS;
  } catch {
    return false;
  }
}

/**
 * Like usePersistedState, but forgotten once the display has been idle a
 * while.
 *
 * For choices that NARROW what is shown. Persisting those outright is risky:
 * returning to a silently filtered list, with no memory of setting it, reads
 * as missing data. Forgetting them after the display has gone to sleep keeps
 * the convenience during a session without that trap.
 */
export function useSessionScopedState<T>(
  key: string,
  initial: T,
  isValid: (v: unknown) => v is T,
): [T, (v: T) => void] {
  const [value, setValue] = usePersistedState<T>(key, initial, isValid);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Checked after mount, not in the initialiser: reading the clock during
    // render would differ between server and client and hydrate mismatched.
    if (!ready) {
      setReady(true);
      if (displayWentIdle()) setValue(initial);
    }
  }, [ready, initial, setValue]);

  return [value, setValue];
}
