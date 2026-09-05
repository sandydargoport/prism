'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';

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
): [T, Dispatch<SetStateAction<T>>] {
  // Always start from `initial`, never from storage.
  //
  // Reading localStorage in the initialiser meant the first client render
  // disagreed with the server's markup — the server has no localStorage, so it
  // always rendered the default. React treats that as a failed hydration
  // (#418), throws the tree away and re-renders. Pages still worked, so it went
  // unnoticed, but every load with a stored grouping paid a full client
  // re-render and briefly showed the ungrouped view. Applying the stored value
  // after mount makes the two renders agree by construction.
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  // `isValid` is usually an inline arrow, so its identity changes every render.
  // Held in a ref so the read below runs once per key rather than per render.
  const validRef = useRef(isValid);
  validRef.current = isValid;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        const parsed = JSON.parse(raw) as unknown;
        // Validated rather than trusted: a stored value can outlive the option
        // that produced it, and a stale one would leave the view in a state the
        // UI no longer offers a way out of.
        if (validRef.current(parsed)) setValue(parsed);
      }
    } catch {
      /* storage unavailable — fall back to the initial value */
    }
    setHydrated(true);
  }, [key]);

  useEffect(() => {
    // Gated on `hydrated`, and deliberately so: writing before the read above
    // has run would overwrite a stored preference with the default on every
    // mount, which is the same as not persisting at all.
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable — the session works, it just will not persist */
    }
  }, [key, value, hydrated]);

  return [value, setValue];
}

/** Validator for a fixed set of string options. */
export function oneOf<T extends string>(...allowed: readonly T[]) {
  return (v: unknown): v is T => typeof v === 'string' && (allowed as readonly string[]).includes(v);
}

export const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';

/** Validator for an array of strings. */
export const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');

/**
 * A Set of strings that survives a refresh.
 *
 * `Set` does not survive JSON — it serialises to `{}` — so a filter stored
 * directly through usePersistedState comes back empty and silently shows
 * everything. Stored as an array and rebuilt on read, in one place rather than
 * at each call site.
 *
 * The identity of the returned Set is stable between renders for the same
 * contents, so it is safe in a dependency array.
 */
export function usePersistedStringSet<T extends string = string>(
  key: string,
  initial: readonly NoInfer<T>[] = [],
  // Optional element guard, for a Set of a string UNION rather than of plain
  // strings. Without it a stored value that outlived its option would come back
  // as a member the UI no longer offers, which is the same trap the scalar
  // validator exists to close.
  isElement?: (v: unknown) => v is T,
): [Set<T>, Dispatch<SetStateAction<Set<T>>>] {
  const guard = useCallback(
    (v: unknown): v is T[] =>
      isStringArray(v) && (!isElement || v.every((x) => isElement(x))),
    [isElement],
  );
  const [list, setList] = usePersistedState<T[]>(key, [...initial], guard);
  const value = useMemo(() => new Set(list), [list]);
  // Accepts an updater as well as a value, so these read exactly like useState
  // at the call site. The updater is resolved against a Set rebuilt from the
  // previous list rather than the memoised one, so it stays correct inside a
  // batched update.
  const set = useCallback<Dispatch<SetStateAction<Set<T>>>>(
    (next) =>
      setList((prev) => {
        const resolved =
          typeof next === 'function'
            ? (next as (p: Set<T>) => Set<T>)(new Set(prev))
            : next;
        return [...resolved].sort();
      }),
    [setList],
  );
  return [value, set];
}

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
): [T, Dispatch<SetStateAction<T>>] {
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

/**
 * Like usePersistedStringSet, but forgotten once the display has been idle a
 * while — the Set equivalent of useSessionScopedState, for filters.
 */
export function useSessionScopedStringSet<T extends string = string>(
  key: string,
  initial: readonly NoInfer<T>[] = [],
  isElement?: (v: unknown) => v is T,
): [Set<T>, Dispatch<SetStateAction<Set<T>>>] {
  const guard = useCallback(
    (v: unknown): v is T[] =>
      isStringArray(v) && (!isElement || v.every((x) => isElement(x))),
    [isElement],
  );
  const [list, setList] = useSessionScopedState<T[]>(key, [...initial], guard);
  const value = useMemo(() => new Set(list), [list]);
  // Accepts an updater as well as a value, so these read exactly like useState
  // at the call site. The updater is resolved against a Set rebuilt from the
  // previous list rather than the memoised one, so it stays correct inside a
  // batched update.
  const set = useCallback<Dispatch<SetStateAction<Set<T>>>>(
    (next) =>
      setList((prev) => {
        const resolved =
          typeof next === 'function'
            ? (next as (p: Set<T>) => Set<T>)(new Set(prev))
            : next;
        return [...resolved].sort();
      }),
    [setList],
  );
  return [value, set];
}
