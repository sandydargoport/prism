'use client';

import { useState, useLayoutEffect, useMemo, useCallback, useEffectEvent } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useLatestRef } from './useLatestRef';
import { parseStored, readStored, useStoredString, writeStored } from './useStoredValue';

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
  // Read from the shared store rather than copied into state after mount. On a
  // client-side mount the stored value is there on the first render; during
  // hydration the store renders `initial`, as the server did, and then the
  // stored value, so the markup matches (a mismatch is React error #418, which
  // throws the tree away and re-renders it).
  const raw = useStoredString(key);
  // Held once, like useState's initial value: callers often pass a fresh array.
  const [fallback] = useState(initial);
  const stored = parseStored(key, raw);
  // Validated rather than trusted: a stored value can outlive the option that
  // produced it, and a stale one would leave the view in a state the UI no
  // longer offers a way out of.
  const value = raw !== null && isValid(stored) ? stored : fallback;

  // Read from refs in the setter, so it keeps one identity while `isValid` is
  // an inline arrow at the call site.
  const isValidRef = useLatestRef(isValid);
  const fallbackRef = useLatestRef(fallback);
  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    (next) => {
      let resolved: T;
      if (typeof next === 'function') {
        // Resolved against the store, not the last render, so two updaters in
        // one batch build on each other.
        const current = parseStored(key, readStored(key));
        const prev = isValidRef.current(current) ? current : fallbackRef.current;
        resolved = (next as (p: T) => T)(prev);
      } else {
        resolved = next;
      }
      writeStored(key, JSON.stringify(resolved));
    },
    [key, isValidRef, fallbackRef],
  );

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

  // Checked after mount, not during render: reading the clock while rendering
  // would differ between server and client and hydrate mismatched. A layout
  // effect, so a forgotten filter is never painted before it is dropped.
  const forgetIfIdle = useEffectEvent(() => {
    if (displayWentIdle()) setValue(initial);
  });
  useLayoutEffect(() => forgetIfIdle(), [key]);

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
