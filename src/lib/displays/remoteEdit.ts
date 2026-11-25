'use client';

/**
 * Editing on a canvas (#1153, #1265).
 *
 * The editor page (/screens/[id] for a named screen, /edit/[id] for a
 * dashboard) shows the real dashboard in a frame the screen's own size,
 * scaled down to fit, so everything that depends on the size of the window
 * (the grid, breakpoints, `vh`) lays out as it does on the wall. The
 * dashboard in the frame opens in edit mode, and its editing panels and
 * dialogs are drawn on the editor page at this device's own size.
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
 * The phone page sends the settings to the screen on Done.
 *
 * A device nobody has named (/edit/[id]) gets the same layer for its own
 * screen settings (#1341): they are held in the host until Done, which writes
 * them to this browser, and Cancel drops them. Everything else it writes goes
 * to its own storage, as it always has.
 */
import { isScreenSettingKey, SCREEN_SETTING_KEYS, type ScreenSettingKey, type ScreenSettings } from './screenSettings';
import type { ScreenSwitch } from '@/lib/screenSwitches';

export const REMOTE_EDIT_GLOBAL = '__prismRemoteEdit';

/** The sync base key in displaySettingsSync, answered for the edited screen. */
const BASE_KEY = 'prism:display-sync-base';

export type RemoteEditHost = {
  /**
   * The named screen being edited, or null when editing a dashboard at a
   * chosen size: then `settings` are this device's own, held until Done
   * writes them to this browser (#1341).
   */
  displayId: string | null;
  /**
   * The dashboard the screen shows and its switches (#1282), changed in place
   * as the editor changes them, and sent to the screen on Done.
   */
  dashboardId: string | null;
  switches: ScreenSwitch[];
  /** The screen's settings, changed in place as the frame writes them. */
  settings: ScreenSettings;
  settingsUpdatedAt: string | null;
  /** Where the frame draws its editing bar and dialogs, on the phone page. */
  root: HTMLElement;
  /** Above and below the picture, where the frame draws the canvas's toggles and its caption (#1348). */
  canvasAbove?: HTMLElement | null;
  canvasBelow?: HTMLElement | null;
  /** The dashboard the frame is showing. */
  onDashboard: (layoutId: string, isDefault: boolean) => void;
  /** Editing ended: saved with Done, or not. */
  onFinish: (saved: boolean) => void;
  /** The screen's settings, dashboard or switches differ from when the page opened: Done has not sent them (#1326). */
  unsaved?: () => boolean;
  /** What Done has not sent yet, for each tab's dot (#1341): the settings keys changed, and whether the dashboard or switches did. */
  pending?: () => { keys: string[]; plan: boolean };
  /** The screen was renamed from the editor's Screen sheet (#1326). */
  onRenamed?: (name: string) => void;
  /** Where Done goes once it has saved, in place of the usual place: another screen's editor, after Save and switch (#1341). */
  next?: string | null;
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

/** In the frame: the screen now shows this and switches so (#1282); the editor page sends it on Done. */
export function setHostPlan(plan: { dashboardId: string | null; switches: ScreenSwitch[] }): void {
  const host = remoteEditHost();
  if (!host) return;
  host.dashboardId = plan.dashboardId;
  host.switches = plan.switches;
}

/** For tests: forget what was found. */
export function resetRemoteEditHost(): void {
  cached = undefined;
}

/** For a device with no name, its real storage, and whether naming it let the held settings go. */
const ownReal = new WeakMap<RemoteEditHost, Storage>();
const released = new WeakSet<RemoteEditHost>();

/**
 * A Storage that answers this screen's settings from the host and keeps every
 * other write in memory, reading through to the real one for the rest.
 */
export function remoteStorage(real: Storage, host: RemoteEditHost): Storage {
  const memory = new Map<string, string | null>();
  // A device editing its own dashboard (#1341): only its screen settings are
  // held, and only until it is named.
  const own = host.displayId === null;
  if (own) ownReal.set(host, real);
  const held = (key: string): key is ScreenSettingKey => isScreenSettingKey(key) && !released.has(host);
  const base = () => JSON.stringify({
    displayId: host.displayId,
    dashboardId: host.dashboardId,
    switches: host.switches,
    settings: host.settings,
    settingsUpdatedAt: host.settingsUpdatedAt,
  });
  const get = (key: string): string | null => {
    if (held(key)) return host.settings[key] ?? null;
    if (own) return real.getItem(key);
    if (key === BASE_KEY) return base();
    if (memory.has(key)) return memory.get(key) ?? null;
    return real.getItem(key);
  };
  return {
    getItem: get,
    setItem(key: string, value: string) {
      const v = String(value);
      if (held(key)) host.settings[key] = v;
      else if (own) real.setItem(key, v);
      else if (key !== BASE_KEY) memory.set(key, v);
    },
    removeItem(key: string) {
      if (held(key)) delete host.settings[key];
      else if (own) real.removeItem(key);
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
 * A device with no name was just named from the editor (#1341): it is a
 * screen now, and its settings live in its own browser again. What the editor
 * holds is written there, and from then on the sync code reads and writes the
 * browser itself, so the settings a screen named before brings land there.
 * Does nothing anywhere else.
 */
export function releaseHeldSettings(): void {
  const host = remoteEditHost();
  const real = host ? ownReal.get(host) : undefined;
  if (!host || !real || released.has(host)) return;
  for (const key of SCREEN_SETTING_KEYS) {
    const value = host.settings[key];
    if (value === undefined) real.removeItem(key);
    else real.setItem(key, value);
  }
  released.add(host);
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

/** On the editor page, above or below the picture (#1348); undefined when there is no such place. */
export function remoteCanvasSlot(where: 'above' | 'below'): HTMLElement | undefined {
  const host = remoteEditHost();
  return (where === 'above' ? host?.canvasAbove : host?.canvasBelow) ?? undefined;
}
