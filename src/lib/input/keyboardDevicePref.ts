'use client';

import { useCallback, useEffect, useState } from 'react';

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
const CHANGE_EVENT = 'prism:keyboard-on-this-device-change';

function isPref(v: unknown): v is KeyboardDevicePref {
  return typeof v === 'string' && (KEYBOARD_DEVICE_PREFS as readonly string[]).includes(v);
}

/** The stored choice, or 'household' when there is none or it is unreadable. */
export function readKeyboardDevicePref(): KeyboardDevicePref {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return 'household';
    const parsed = JSON.parse(raw) as unknown;
    return isPref(parsed) ? parsed : 'household';
  } catch {
    return 'household';
  }
}

/** Store the choice and tell every mounted hook in this tab. */
export function writeKeyboardDevicePref(pref: KeyboardDevicePref): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pref));
  } catch {
    /* storage unavailable: the choice applies to this page view only */
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: pref }));
}

/**
 * The device's choice. `ready` is false until it has been read from storage
 * after mount; before that `pref` is the default, so a caller must not act on
 * it (a device set to Never would briefly behave as if set to Always).
 */
export function useKeyboardDevicePref() {
  const [pref, setPrefState] = useState<KeyboardDevicePref>('household');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPrefState(readKeyboardDevicePref());
    setReady(true);
    const onChange = (e: Event) => {
      if (e instanceof CustomEvent && isPref(e.detail)) setPrefState(e.detail);
    };
    // Another tab of the same browser changed it.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setPrefState(readKeyboardDevicePref());
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setPref = useCallback((next: KeyboardDevicePref) => {
    setPrefState(next);
    writeKeyboardDevicePref(next);
  }, []);

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
