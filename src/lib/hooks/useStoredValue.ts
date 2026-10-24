'use client';

import { useSyncExternalStore } from 'react';

/**
 * localStorage as an external store, for per-display preferences.
 *
 * Each preference hook used to copy storage into state in a mount effect, and
 * keep its copies in step with custom window events. That cost a render with
 * the default on every client-side mount, and two mounted hooks on the same key
 * drifted apart whenever one of them forgot to announce a change.
 *
 * Read through useSyncExternalStore instead, the value is right on the first
 * render of a client-side mount. During hydration React renders the server
 * snapshot (nothing stored) and then the real value, so the markup still
 * matches. Every write through writeStored reaches every hook on that key, in
 * this tab and, through the storage event, in other tabs.
 */

const listeners = new Set<() => void>();

/**
 * Values written while localStorage refuses writes (quota, blocked site data).
 * The choice still holds for this page view, just not past a reload.
 */
const unsaved = new Map<string, string | null>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** Another tab wrote (or cleared, when `key` is null): its value wins. */
function onStorage(e: StorageEvent): void {
  if (e.key === null) unsaved.clear();
  else unsaved.delete(e.key);
  notify();
}

// Always attached, not only while a hook is mounted, so a value another tab
// wrote in the meantime also replaces one held in `unsaved`.
if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The raw stored string, or null when nothing is stored or storage is unavailable. */
export function readStored(key: string): string | null {
  if (unsaved.has(key)) return unsaved.get(key) ?? null;
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Store a raw string (null removes the key) and tell every hook reading it. */
export function writeStored(key: string, raw: string | null): void {
  try {
    if (raw === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, raw);
    unsaved.delete(key);
  } catch {
    unsaved.set(key, raw);
  }
  notify();
}

/** The raw stored string for `key`, re-rendering when it changes. */
export function useStoredString(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => readStored(key),
    () => null,
  );
}

/**
 * The last JSON parse per key. useSyncExternalStore compares snapshots by
 * identity, and a fresh JSON.parse on every render would hand callers a new
 * array or object each time, so the parse is redone only when the string is.
 */
const parsed = new Map<string, { raw: string; value: unknown }>();

/** Parse a stored string, keeping the result's identity while `raw` is unchanged. */
export function parseStored(key: string, raw: string | null): unknown {
  if (raw === null) return undefined;
  const hit = parsed.get(key);
  if (hit && hit.raw === raw) return hit.value;
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    value = undefined;
  }
  parsed.set(key, { raw, value });
  return value;
}

const noSubscribe = () => () => {};

/**
 * False during the server render and hydration, true from then on.
 *
 * For a hook that must not act on a preference until the display's own value
 * is in. On a client-side mount it is true from the first render, because the
 * stored value is too.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
}
