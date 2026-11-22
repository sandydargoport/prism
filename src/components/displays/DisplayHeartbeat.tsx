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
import { PERF_CLASS, PERF_MINIMAL_CLASS, type PerfLevel } from '@/lib/perfLevel';

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
    const { applied, planChanged } = await syncScreenSettings();
    // A screen showing a dashboard goes through the home page, where the
    // server sends a named screen to the one it shows now (#1282). Elsewhere
    // (Settings, a list) it is left where someone is using it, and its own
    // editor is never reloaded under the person editing (#1280): Done loads
    // its dashboard afresh.
    const path = window.location.pathname;
    if (path.startsWith('/screens/') || path.startsWith('/edit/')) return;
    if (planChanged && (path === '/' || path.startsWith('/d/'))) reloadForRemoteChange('/');
    else if (applied.length > 0) reloadForRemoteChange();
  } catch {
    // Offline for a moment; the next round will do.
  } finally {
    syncing = false;
  }
}

/**
 * How this screen runs, for Settings > Screens (#1289): the performance level
 * in force, read from the classes it sets on <html>, and whether the browser
 * asks for reduced motion. Either below Full or asking for less turns
 * fireworks into a fade (Screensaver).
 */
function howItRuns(): { perfLevel: PerfLevel; reducedMotion: boolean } {
  const html = document.documentElement.classList;
  const perfLevel: PerfLevel = html.contains(PERF_MINIMAL_CLASS) ? 'minimal' : html.contains(PERF_CLASS) ? 'reduced' : 'full';
  return { perfLevel, reducedMotion: !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches };
}

/** One beat; says whether another device is editing this screen, or null when unknown. */
async function beat(): Promise<boolean | null> {
  if (!isNamed()) return null;
  try {
    const res = await fetch('/api/displays/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ width: window.innerWidth, height: window.innerHeight, ...howItRuns() }),
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
