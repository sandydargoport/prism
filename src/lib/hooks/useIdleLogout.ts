'use client';

import { useEffect, useEffectEvent } from 'react';
import { readStored, useStoredString, writeStored } from './useStoredValue';
import { useAuth } from '@/components/providers';

/** Written by useIdleDetection on any interaction anywhere in the app. */
const LAST_ACTIVITY_KEY = 'prism-last-activity';

import { DEFAULT_IDLE_LOGOUT_MINUTES, IDLE_LOGOUT_KEY } from './idleLogoutOptions';

export { DEFAULT_IDLE_LOGOUT_MINUTES, IDLE_LOGOUT_KEY, IDLE_LOGOUT_OPTIONS } from './idleLogoutOptions';

function parseMinutes(stored: string | null): number {
  if (stored === null) return DEFAULT_IDLE_LOGOUT_MINUTES;
  const n = Number(stored);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_IDLE_LOGOUT_MINUTES;
}

export function getIdleLogoutMinutes(): number {
  return parseMinutes(readStored(IDLE_LOGOUT_KEY));
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
/** Read/write the setting. A refused write holds for this page view only. */
export function useIdleLogoutSetting(): [number, (v: number) => void] {
  const minutes = parseMinutes(useStoredString(IDLE_LOGOUT_KEY));
  const update = (v: number) => writeStored(IDLE_LOGOUT_KEY, String(v));
  return [minutes, update];
}

/**
 * Is the device this page runs on kept signed in (#1044)? A kept phone is a
 * parent's own, so walking away from it is not a reason to sign it out (#1104).
 * Asked only when the idle timer is about to fire. Null when the answer did not
 * come back: the caller waits a minute rather than guessing either way.
 */
export async function deviceIsKept(fetchFn: typeof fetch = fetch): Promise<boolean | null> {
  try {
    const res = await fetchFn('/api/auth/sessions');
    if (!res.ok) return res.status === 401 ? false : null;
    const body = (await res.json()) as { sessions?: Array<{ current?: boolean; kept?: boolean }> };
    return body.sessions?.find((s) => s.current)?.kept === true;
  } catch {
    return null;
  }
}

export function useIdleLogout() {
  const { activeUser, clearActiveUser } = useAuth();
  const isSignedIn = useEffectEvent(() => Boolean(activeUser));

  useEffect(() => {
    const minutes = getIdleLogoutMinutes();
    if (minutes <= 0) return;
    let asking = false;

    const check = () => {
      // Nothing to do when nobody is signed in — avoids a pointless logout
      // request every minute on a display that is already anonymous.
      if (!isSignedIn()) return;
      try {
        const raw = window.localStorage.getItem(LAST_ACTIVITY_KEY);
        if (raw === null) return;
        const last = Number(raw);
        if (!Number.isFinite(last)) return;
        if (!shouldLogOut(minutes, last, Date.now()) || asking) return;
        asking = true;
        void deviceIsKept()
          .then((kept) => { if (kept === false) clearActiveUser(); })
          .finally(() => { asking = false; });
      } catch {
        /* storage unavailable — leave the session alone rather than guessing */
      }
    };

    const timer = setInterval(check, 60_000);
    return () => clearInterval(timer);
  }, [clearActiveUser]);
}
