'use client';

/**
 * Keeps a named screen's settings in step with its `displays` row (#690).
 *
 * The browser copy (localStorage) is what every part of the app reads, so it
 * stays where it is. This module reconciles it with the row:
 *
 *   - A change made on the screen is sent up within a few seconds. Rather than
 *     hook every place that writes a setting, it compares the browser's values
 *     with the last ones it agreed with the server (the "base"), so a setting
 *     written straight to localStorage is caught as surely as one written
 *     through the shared store.
 *   - A change made from another device moves the row's settingsUpdatedAt. The
 *     heartbeat reports it, the screen fetches the settings, writes the new
 *     values into the browser copy and reloads once, so that code which reads
 *     a setting only when it mounts sees the new value too.
 *
 * Both directions are one request: send what changed here, get back the
 * settings as stored. The server merges per key, so an edit here and one from
 * a phone to different settings both survive. Two edits to the same setting:
 * the later one wins.
 */
import { readStored, writeStored } from '@/lib/hooks/useStoredValue';
import { diffSettings, SCREEN_SETTING_KEYS, type ScreenSettings } from './screenSettings';

/** The settings this browser last agreed with the server on, and for which screen. */
const BASE_KEY = 'prism:display-sync-base';
/** When this tab last reloaded to apply a remote edit, so it cannot loop. */
const RELOADED_AT_KEY = 'prism:display-sync-reloaded-at';
const MIN_RELOAD_GAP_MS = 60 * 1000;

export type SyncBase = {
  displayId: string;
  dashboardId?: string | null;
  settings: ScreenSettings;
  settingsUpdatedAt: string | null;
};

export function readLocalSettings(): ScreenSettings {
  const out: ScreenSettings = {};
  for (const key of SCREEN_SETTING_KEYS) {
    const raw = readStored(key);
    if (raw !== null) out[key] = raw;
  }
  return out;
}

export function loadBase(): SyncBase | null {
  try {
    const raw = localStorage.getItem(BASE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SyncBase;
    return parsed && typeof parsed.displayId === 'string' && parsed.settings ? parsed : null;
  } catch {
    return null;
  }
}

function saveBase(base: SyncBase | null): void {
  try {
    if (base) localStorage.setItem(BASE_KEY, JSON.stringify(base));
    else localStorage.removeItem(BASE_KEY);
  } catch {
    // Storage refused: the next sync starts over as a first sync, which is safe.
  }
}

/** Forget the base, e.g. when this browser is named, renamed into another screen, or forgotten. */
export function resetSyncBase(): void {
  saveBase(null);
}

/** Does this browser have changes the server has not seen? */
export function hasLocalChanges(): boolean {
  const base = loadBase();
  if (!base) return true;
  return Object.keys(diffSettings(base.settings, readLocalSettings())).length > 0;
}

type SyncResponse = {
  displayId: string;
  dashboardId: string | null;
  settings: ScreenSettings;
  settingsUpdatedAt: string | null;
};

export type SyncResult = {
  /** Keys whose value came from the server. */
  applied: string[];
  /** The screen's dashboard was changed elsewhere since the last sync. */
  dashboardChanged: boolean;
};

async function post(changes: Record<string, string | null>, baseDisplayId: string | null): Promise<SyncResponse | null> {
  const res = await fetch('/api/displays/current/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ changes, baseDisplayId }),
  });
  if (res.status === 404) {
    // No longer a named screen (removed elsewhere); the server cleared the cookie.
    resetSyncBase();
    return null;
  }
  if (!res.ok) return null;
  return res.json();
}

/**
 * One round: send this screen's changes, apply the server's. Says what came
 * from the server, so the caller can decide to reload.
 *
 * With no base, everything this browser has is sent, and the server decides
 * (see the settings route): a screen with nothing stored takes it, a screen
 * with settings already keeps them. The same holds when the base belongs to
 * another screen, which the server sees from baseDisplayId.
 */
export async function syncScreenSettings(): Promise<SyncResult> {
  const base = loadBase();
  const local = readLocalSettings();

  const result = await post(base ? diffSettings(base.settings, local) : local, base?.displayId ?? null);
  if (!result) return { applied: [], dashboardChanged: false };

  const applied: string[] = [];
  for (const [key, value] of Object.entries(diffSettings(readLocalSettings(), result.settings))) {
    writeStored(key, value ?? null);
    applied.push(key);
  }

  const dashboardChanged = base?.displayId === result.displayId && (base.dashboardId ?? null) !== result.dashboardId;
  saveBase({
    displayId: result.displayId,
    dashboardId: result.dashboardId,
    settings: result.settings,
    settingsUpdatedAt: result.settingsUpdatedAt,
  });
  return { applied, dashboardChanged };
}

/**
 * Reload to apply remote values, at most once a minute per tab. With `href`,
 * load that page instead of the current one.
 */
export function reloadForRemoteChange(href?: string): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_AT_KEY) ?? 0);
    if (Date.now() - last < MIN_RELOAD_GAP_MS) return false;
    sessionStorage.setItem(RELOADED_AT_KEY, String(Date.now()));
  } catch {
    // No session storage: reloading anyway is better than showing stale settings.
  }
  if (href) window.location.assign(href);
  else window.location.reload();
  return true;
}
