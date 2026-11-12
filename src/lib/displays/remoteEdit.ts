'use client';

/**
 * Editing one screen from another device (#1153).
 *
 * The phone page (/screens/[id]) shows the screen's real dashboard in a frame
 * the screen's own size, scaled down to fit, so everything that depends on
 * the size of the window (the grid, breakpoints, `vh`) lays out as it does on
 * the wall. The dashboard in the frame opens in edit mode, and its editing
 * bar and dialogs are drawn on the phone page at the phone's own size.
 *
 * The two pages share an origin, so the frame reaches the phone page through
 * `window.parent`. The phone page puts a host object there; the frame finds it
 * and then:
 *
 *   - reads and writes this screen's settings in the host instead of the
 *     browser's own storage, and keeps every other write in memory, so editing
 *     the kitchen from a phone changes nothing on the phone;
 *   - stops being a named screen of its own (no heartbeat, no sync);
 *   - draws its editing bar and dialogs into `host.root`;
 *   - tells the host which dashboard it is on, and when editing ends.
 *
 * The phone page sends the settings and the dashboard to the screen on Done.
 */
import { isScreenSettingKey, type ScreenSettings } from './screenSettings';

export const REMOTE_EDIT_GLOBAL = '__prismRemoteEdit';

/** The sync base key in displaySettingsSync, answered for the edited screen. */
const BASE_KEY = 'prism:display-sync-base';

export type RemoteEditHost = {
  displayId: string;
  /** The screen's dashboard when editing began; null is the household default. */
  dashboardId: string | null;
  /** The screen's settings, changed in place as the frame writes them. */
  settings: ScreenSettings;
  settingsUpdatedAt: string | null;
  /** Where the frame draws its editing bar and dialogs, on the phone page. */
  root: HTMLElement;
  /** The dashboard the frame is showing. */
  onDashboard: (layoutId: string, isDefault: boolean) => void;
  /** Editing ended: saved with Done, or not. */
  onFinish: (saved: boolean) => void;
};

type HostWindow = Window & { [REMOTE_EDIT_GLOBAL]?: RemoteEditHost };

let cached: RemoteEditHost | null | undefined;

/** The host when this page is the frame of a phone editing a screen, else null. */
export function remoteEditHost(): RemoteEditHost | null {
  if (cached !== undefined) return cached;
  if (typeof window === 'undefined') return null;
  try {
    const parent = window.parent as HostWindow;
    cached = parent !== window ? parent[REMOTE_EDIT_GLOBAL] ?? null : null;
  } catch {
    // A frame from another origin: never this.
    cached = null;
  }
  return cached;
}

/** For tests: forget what was found. */
export function resetRemoteEditHost(): void {
  cached = undefined;
}

/**
 * A Storage that answers this screen's settings from the host and keeps every
 * other write in memory, reading through to the real one for the rest.
 */
export function remoteStorage(real: Storage, host: RemoteEditHost): Storage {
  const memory = new Map<string, string | null>();
  const base = () => JSON.stringify({
    displayId: host.displayId,
    dashboardId: host.dashboardId,
    settings: host.settings,
    settingsUpdatedAt: host.settingsUpdatedAt,
  });
  const get = (key: string): string | null => {
    if (isScreenSettingKey(key)) return host.settings[key] ?? null;
    if (key === BASE_KEY) return base();
    if (memory.has(key)) return memory.get(key) ?? null;
    return real.getItem(key);
  };
  return {
    getItem: get,
    setItem(key: string, value: string) {
      const v = String(value);
      if (isScreenSettingKey(key)) host.settings[key] = v;
      else if (key !== BASE_KEY) memory.set(key, v);
    },
    removeItem(key: string) {
      if (isScreenSettingKey(key)) delete host.settings[key];
      else if (key !== BASE_KEY) memory.set(key, null);
    },
    clear() {
      memory.clear();
    },
    key: (i: number) => real.key(i),
    get length() {
      return real.length;
    },
  };
}

/**
 * In the frame, swap the window's storage for the remote one before anything
 * reads it. Imported for its effect by the providers, ahead of the rest.
 */
export function installRemoteStorage(): void {
  const host = remoteEditHost();
  if (!host) return;
  try {
    const shim = remoteStorage(window.localStorage, host);
    Object.defineProperty(window, 'localStorage', { configurable: true, get: () => shim });
  } catch {
    // Storage blocked outright: there is nothing to keep apart.
  }
}

/** The screen settings that differ from `from`, as a PATCH body's `settings`. */
export function changedSettings(from: ScreenSettings, to: ScreenSettings): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const key of new Set([...Object.keys(from), ...Object.keys(to)])) {
    if (!isScreenSettingKey(key)) continue;
    const a = from[key] ?? null;
    const b = to[key] ?? null;
    if (a !== b) out[key] = b;
  }
  return out;
}

installRemoteStorage();

/**
 * Where a dialog or sheet opened in the frame is drawn: the phone page, so it
 * is the phone's own size rather than shrunk with the picture. Undefined
 * outside a remote edit, which leaves each portal on its usual default.
 */
export function remotePortalRoot(): HTMLElement | undefined {
  return remoteEditHost()?.root ?? undefined;
}
