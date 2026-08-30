'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/providers';

/** Written by useIdleDetection on any interaction anywhere in the app. */
const LAST_ACTIVITY_KEY = 'prism-last-activity';

/** Minutes of inactivity before the display signs itself out. */
export const IDLE_LOGOUT_KEY = 'prism-idle-logout-minutes';
export const DEFAULT_IDLE_LOGOUT_MINUTES = 30;

export const IDLE_LOGOUT_OPTIONS = [
  { value: 0, label: 'Never' },
  { value: 5, label: '5 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 240, label: '4 hours' },
] as const;

export function getIdleLogoutMinutes(): number {
  if (typeof window === 'undefined') return DEFAULT_IDLE_LOGOUT_MINUTES;
  try {
    const stored = window.localStorage.getItem(IDLE_LOGOUT_KEY);
    if (stored === null) return DEFAULT_IDLE_LOGOUT_MINUTES;
    const n = Number(stored);
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_IDLE_LOGOUT_MINUTES;
  } catch {
    return DEFAULT_IDLE_LOGOUT_MINUTES;
  }
}

/** True when the display has gone untouched for longer than the setting. */
export function shouldLogOut(minutes: number, lastActivity: number, now: number): boolean {
  if (minutes <= 0) return false;
  return now - lastActivity > minutes * 60 * 1000;
}

/**
 * Sign the display out after a stretch of inactivity.
 *
 * A parent session lasts 7 days and its window is refreshed on every request,
 * and the dashboard polls constantly — so once someone signs in at a wall
 * display, that display is authenticated as them until the 30-day absolute cap.
 * Anyone who walks up inherits it.
 *
 * Reading is unaffected: `getDisplayAuth` serves the dashboard from the
 * configured display user when there is no session, so the calendar, tasks and
 * messages stay on screen. What comes back is the PIN prompt on anything that
 * writes, which is where a credential actually means something.
 *
 * Deliberately on its own timer rather than hooked to the screensaver. The
 * screensaver is cosmetic and often set to two minutes; being asked for a PIN
 * that often would train people to resent it. This is the longer question of
 * whether anyone is still here.
 */
/** Read/write the setting, with the change event other tabs listen for. */
export function useIdleLogoutSetting(): [number, (v: number) => void] {
  const [minutes, setMinutes] = useState<number>(() => getIdleLogoutMinutes());
  useEffect(() => setMinutes(getIdleLogoutMinutes()), []);
  const update = (v: number) => {
    setMinutes(v);
    try {
      window.localStorage.setItem(IDLE_LOGOUT_KEY, String(v));
    } catch {
      /* storage unavailable — the choice holds for this session only */
    }
  };
  return [minutes, update];
}

export function useIdleLogout() {
  const { activeUser, clearActiveUser } = useAuth();
  const activeRef = useRef(activeUser);
  activeRef.current = activeUser;

  useEffect(() => {
    const minutes = getIdleLogoutMinutes();
    if (minutes <= 0) return;

    const check = () => {
      // Nothing to do when nobody is signed in — avoids a pointless logout
      // request every minute on a display that is already anonymous.
      if (!activeRef.current) return;
      try {
        const raw = window.localStorage.getItem(LAST_ACTIVITY_KEY);
        if (raw === null) return;
        const last = Number(raw);
        if (!Number.isFinite(last)) return;
        if (shouldLogOut(minutes, last, Date.now())) clearActiveUser();
      } catch {
        /* storage unavailable — leave the session alone rather than guessing */
      }
    };

    const timer = setInterval(check, 60_000);
    return () => clearInterval(timer);
  }, [clearActiveUser]);
}
