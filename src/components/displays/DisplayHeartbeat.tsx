'use client';

import { useEffect, useRef, useState } from 'react';
import { useVisibilityPolling } from '@/lib/hooks/useVisibilityPolling';
import {
  hasLocalChanges,
  loadBase,
  reloadForRemoteChange,
  resetSyncBase,
  syncScreenSettings,
} from '@/lib/displays/displaySettingsSync';
import { isNamedScreen as isNamed } from '@/lib/displays/namedScreen';

/**
 * Keeps a named screen in touch with the server (#690): a heartbeat for
 * "online 2 min ago" in Settings > Screens, and its settings in step with its
 * row (see displaySettingsSync). Only a browser carrying the readable marker
 * the server sets when a screen is named does anything, so phones and unnamed
 * browsers make no requests at all.
 *
 * Keeps going while the screensaver is up: an idle wall screen is still on.
 * The heartbeat runs every 60 s (150 s in performance mode), inside the 5
 * minute online window. Local changes are looked for every few seconds, which
 * reads a handful of storage keys and sends nothing unless one changed.
 *
 * Each beat also sends the screen's size, so a phone editing it can show it at
 * its own size and shape (#1153). While a phone is editing it, the screen says
 * so in a small note and beats every few seconds, so what was changed shows
 * soon after Done; when the edit ends it reloads once to show the result.
 */
const BEAT_MS = 60 * 1000;
const EDITING_BEAT_MS = 5 * 1000;
const LOCAL_CHECK_MS = 5 * 1000;

let syncing = false;

/** Sync once; reload if the server had values this browser did not. */
async function sync(): Promise<void> {
  if (syncing || !isNamed()) return;
  syncing = true;
  try {
    const { applied, dashboardChanged } = await syncScreenSettings();
    // A screen showing a dashboard goes through the home page, where the
    // server sends a named screen to its own one. Elsewhere (Settings, a list)
    // it is left where someone is using it.
    const path = window.location.pathname;
    if (dashboardChanged && (path === '/' || path.startsWith('/d/'))) reloadForRemoteChange('/');
    else if (applied.length > 0) reloadForRemoteChange();
  } catch {
    // Offline for a moment; the next round will do.
  } finally {
    syncing = false;
  }
}

/** One beat; says whether another device is editing this screen, or null when unknown. */
async function beat(): Promise<boolean | null> {
  if (!isNamed()) return null;
  try {
    const res = await fetch('/api/displays/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ width: window.innerWidth, height: window.innerHeight }),
    });
    if (!res.ok) return null;
    const { display } = await res.json();
    if (!display) {
      resetSyncBase();
      return false;
    }
    if (display.settingsUpdatedAt !== (loadBase()?.settingsUpdatedAt ?? null)) await sync();
    return display.editing === true;
  } catch {
    // Offline for a moment; the next beat will do.
    return null;
  }
}

function checkLocal(): void {
  if (isNamed() && hasLocalChanges()) void sync();
}

export function DisplayHeartbeat() {
  const [editing, setEditing] = useState(false);
  const editingRef = useRef(false);
  const round = () => void beat().then((now) => {
    if (now === null) return;
    // The phone pressed Done or Cancel: show what it left.
    if (editingRef.current && !now) reloadForRemoteChange();
    editingRef.current = now;
    setEditing(now);
  });
  useEffect(() => {
    void sync().then(round);
  }, []);
  useVisibilityPolling(round, editing ? EDITING_BEAT_MS : BEAT_MS, { pollWhileIdle: true });
  useVisibilityPolling(checkLocal, LOCAL_CHECK_MS, { pollWhileIdle: true });
  if (!editing) return null;
  return (
    <div
      role="status"
      className="pointer-events-none fixed left-1/2 top-[max(0.75rem,env(safe-area-inset-top))] z-300 -translate-x-1/2 rounded-full bg-card/90 px-4 py-1.5 text-caption text-card-foreground shadow-lg"
      data-remote-editing-note
    >
      Being edited from a phone
    </div>
  );
}
