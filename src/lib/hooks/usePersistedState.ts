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
