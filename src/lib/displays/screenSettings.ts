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
 * keyboard and the screen layout settings. Theme stayed per browser then.
 * The time-of-day schedule and the attention panel joined 2026-10-30 (#692);
 * the schedule left 2026-11-20 for the timeline the screen follows (#1266).
 * The screensaver background left 2026-10-31 for the dashboard (#782).
 * The sign-out timer joined 2026-11-11 (#1159), when it left Settings for the
 * editing bar.
 * Light or dark, the seasonal theme, the photos behind the dashboard (on or
 * off, how often they change, matched to the screen's shape), the pinned
 * photos and which time zone it shows joined 2026-11-24 (#1340), so a laptop
 * editing a screen draws it as the screen does. A named screen stores Light or
 * Dark, never `system`: see `concreteThemeMode` in displaySettingsSync.
 * The screen's day (idle look by day and at night, when night is, how much
 * darker) joined 2026-11-24 (#1345), taking over from the dashboard's idle
 * background and from `prism-screensaver-dim`, which stays listed so 0057's
 * removal of it reaches each browser and a browser with no name keeps it.
 * Derived values (the screensaver layout bridged from the dashboard) and
 * per-browser memory (which constellation was last taught) are left out.
 */
export const SCREEN_SETTING_KEYS = [
  // Screensaver: when it starts, what it shows, how widgets move.
  'prism-screensaver-timeout',
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
  // The screen's day: idle look by day and at night, night rule, how much darker (#1345).
  'prism-screen-day',
  // Performance mode.
  'prism-perf-mode',
  // Keyboard and the shape of the screen.
  'prism:keyboard-on-this-device',
  'prism-orientation-override',
  'prism:screen-safe-zones',
  'prism:auto-hide-ui',
  // How long until the screen stops being signed in as whoever used it.
  'prism-idle-logout-minutes',
  // Which notices it shows in the attention panel (#692).
  'prism-screen-attention',
  // Light or dark, and the seasonal accents (#1340).
  'prism-theme',
  'prism-seasonal-theme',
  // The photos behind the dashboard, and the photos pinned on it (#1340).
  'prism-wallpaper-enabled',
  'prism-wallpaper-interval',
  'prism-wallpaper-auto-orientation',
  'prism-pinned-wallpaper',
  'prism-pinned-screensaver',
  // The household's time zone or the device's own (#1340).
  'prism:display-timezone-mode',
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
