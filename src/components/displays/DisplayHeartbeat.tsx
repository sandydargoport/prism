'use client';

import { useEffect } from 'react';
import { useVisibilityPolling } from '@/lib/hooks/useVisibilityPolling';
import {
  hasLocalChanges,
  loadBase,
  reloadForRemoteChange,
  resetSyncBase,
  syncScreenSettings,
} from '@/lib/displays/displaySettingsSync';

/**
 * Keeps a named screen in touch with the server (#690): a heartbeat for
 * "online 2 min ago" in Settings > Displays, and its settings in step with its
 * row (see displaySettingsSync). Only a browser carrying the readable marker
 * the server sets when a screen is named does anything, so phones and unnamed
 * browsers make no requests at all.
 *
 * Keeps going while the screensaver is up: an idle wall screen is still on.
 * The heartbeat runs every 60 s (150 s in performance mode), inside the 5
 * minute online window. Local changes are looked for every few seconds, which
 * reads a handful of storage keys and sends nothing unless one changed.
 */
const BEAT_MS = 60 * 1000;
const LOCAL_CHECK_MS = 5 * 1000;

function isNamed(): boolean {
  return document.cookie.split('; ').includes('prism_display_named=1');
}

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

async function beat(): Promise<void> {
  if (!isNamed()) return;
  try {
    const res = await fetch('/api/displays/heartbeat', { method: 'POST' });
    if (!res.ok) return;
    const { display } = await res.json();
    if (!display) {
      resetSyncBase();
      return;
    }
    if (display.settingsUpdatedAt !== (loadBase()?.settingsUpdatedAt ?? null)) await sync();
  } catch {
    // Offline for a moment; the next beat will do.
  }
}

function checkLocal(): void {
  if (isNamed() && hasLocalChanges()) void sync();
}

export function DisplayHeartbeat() {
  useEffect(() => {
    void sync().then(beat);
  }, []);
  useVisibilityPolling(() => void beat(), BEAT_MS, { pollWhileIdle: true });
  useVisibilityPolling(checkLocal, LOCAL_CHECK_MS, { pollWhileIdle: true });
  return null;
}
