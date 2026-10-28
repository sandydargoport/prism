/**
 * The settings that belong to a screen rather than the household (#690).
 *
 * Each is stored in the browser under the key listed here, as it always was.
 * On a named screen the same values are also kept on its `displays` row, so
 * they survive a browser reset and can be edited from another device. The
 * browser copy is what the app reads; the row is the copy that counts, and
 * the two are reconciled by `displaySettingsSync`.
 *
 * Values are the raw strings the browser stores, so nothing here needs to know
 * what each setting means. A key with no stored value is simply absent.
 *
 * Chosen 2026-10-27: screensaver and drift, performance mode, the on-screen
 * keyboard and the screen layout settings. Theme stays per browser for now.
 * Derived values (the screensaver layout bridged from the dashboard) and
 * per-browser memory (which constellation was last taught) are left out.
 */
export const SCREEN_SETTING_KEYS = [
  // Screensaver: when it starts, what it shows, how widgets move.
  'prism-screensaver-timeout',
  'prism-screensaver-backdrop',
  'prism-screensaver-interval',
  'prism-screensaver-motion',
  'prism-screensaver-motion-v2',
  'prism-screensaver-motion-interval',
  'prism-screensaver-min-widgets',
  'prism-screensaver-max-widgets',
  'prism-screensaver-outlines',
  'prism-screensaver-shortcut',
  'prism-screensaver-drift',
  'prism-screensaver-carbonation',
  'prism-screensaver-wobble',
  'prism-screensaver-speed',
  'prism-screensaver-water-clear',
  'prism-screensaver-dim',
  'prism-screensaver-dim-hours',
  // Performance mode.
  'prism-perf-mode',
  // Keyboard and the shape of the screen.
  'prism:keyboard-on-this-device',
  'prism-orientation-override',
  'prism:screen-safe-zones',
  'prism:auto-hide-ui',
] as const;

export type ScreenSettingKey = (typeof SCREEN_SETTING_KEYS)[number];

export type ScreenSettings = Partial<Record<ScreenSettingKey, string>>;

/** A change to apply: a new raw value, or null to unset it. */
export type ScreenSettingChanges = Partial<Record<ScreenSettingKey, string | null>>;

/** Far above any real value (the longest is a small JSON object). */
export const SCREEN_SETTING_MAX_LENGTH = 2000;

const KEYS = new Set<string>(SCREEN_SETTING_KEYS);

export function isScreenSettingKey(key: string): key is ScreenSettingKey {
  return KEYS.has(key);
}

/**
 * Validated changes from a request body, or null if anything in it is not a
 * known key with a string (or null) value of sensible length. All or nothing,
 * so a bad request never half-applies.
 */
export function cleanSettingChanges(raw: unknown): ScreenSettingChanges | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: ScreenSettingChanges = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isScreenSettingKey(key)) return null;
    if (value === null) out[key] = null;
    else if (typeof value === 'string' && value.length <= SCREEN_SETTING_MAX_LENGTH) out[key] = value;
    else return null;
  }
  return out;
}

/** `current` with `changes` applied; null removes a key. */
export function mergeSettings(current: ScreenSettings, changes: ScreenSettingChanges): ScreenSettings {
  const next: ScreenSettings = {};
  for (const [key, value] of Object.entries(current)) {
    if (isScreenSettingKey(key) && typeof value === 'string') next[key] = value;
  }
  for (const [key, value] of Object.entries(changes) as [ScreenSettingKey, string | null][]) {
    if (value === null) delete next[key];
    else next[key] = value;
  }
  return next;
}

/** Keys whose value differs between two snapshots (absent counts as a value). */
export function diffSettings(from: ScreenSettings, to: ScreenSettings): ScreenSettingChanges {
  const changes: ScreenSettingChanges = {};
  for (const key of SCREEN_SETTING_KEYS) {
    if ((from[key] ?? null) !== (to[key] ?? null)) changes[key] = to[key] ?? null;
  }
  return changes;
}
