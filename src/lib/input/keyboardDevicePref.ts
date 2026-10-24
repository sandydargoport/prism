'use client';

import { useCallback } from 'react';
import { parseStored, readStored, useHydrated, useStoredString, writeStored } from '@/lib/hooks/useStoredValue';

/**
 * Whether Prism's on-screen keyboard is used on THIS device (#525).
 *
 * The household setting `input.virtualKeyboardEnabled` applies to every
 * device, but devices need different answers: a kiosk thin client has no
 * system keyboard, while a tablet's own keyboard is better than Prism's. This
 * per-browser choice overrides the household setting, and 'household' (the
 * default) keeps it in charge, so nothing changes until someone chooses.
 */
export type KeyboardDevicePref = 'household' | 'always' | 'never';

export const KEYBOARD_DEVICE_PREFS: readonly KeyboardDevicePref[] = ['household', 'always', 'never'];

const STORAGE_KEY = 'prism:keyboard-on-this-device';

function isPref(v: unknown): v is KeyboardDevicePref {
  return typeof v === 'string' && (KEYBOARD_DEVICE_PREFS as readonly string[]).includes(v);
}

function toPref(raw: string | null): KeyboardDevicePref {
  const parsed = parseStored(STORAGE_KEY, raw);
  return isPref(parsed) ? parsed : 'household';
}

/** The stored choice, or 'household' when there is none or it is unreadable. */
export function readKeyboardDevicePref(): KeyboardDevicePref {
  return toPref(readStored(STORAGE_KEY));
}

/**
 * Store the choice and tell every mounted hook. A refused write still
 * applies to this page view.
 */
export function writeKeyboardDevicePref(pref: KeyboardDevicePref): void {
  writeStored(STORAGE_KEY, JSON.stringify(pref));
}

/**
 * The device's choice. `ready` is false during hydration, when `pref` is
 * still the server's default, so a caller must not act on it (a device set
 * to Never would briefly behave as if set to Always). On a client-side mount
 * it is true from the first render.
 */
export function useKeyboardDevicePref() {
  const pref = toPref(useStoredString(STORAGE_KEY));
  const ready = useHydrated();
  const setPref = useCallback((next: KeyboardDevicePref) => writeKeyboardDevicePref(next), []);
  return { pref, setPref, ready };
}

/**
 * Whether Prism's keyboard is on for this device, or null while that is not
 * known yet. `household` is null until the household setting has loaded.
 */
export function effectiveKeyboardEnabled(
  pref: KeyboardDevicePref,
  prefReady: boolean,
  household: boolean | null,
): boolean | null {
  if (!prefReady) return null;
  if (pref === 'always') return true;
  if (pref === 'never') return false;
  return household;
}
