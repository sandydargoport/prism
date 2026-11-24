import { modeFrom } from '@/lib/perfLevel';
import { DEFAULT_IDLE_LOGOUT_MINUTES, IDLE_LOGOUT_OPTIONS } from '@/lib/hooks/idleLogoutOptions';
import type { ScreenSettingChanges, ScreenSettingKey, ScreenSettings } from './screenSettings';

/**
 * A screen's own options under Look > This screen (#690, #1153).
 *
 * This table describes each one: which stored key, the raw strings its hook
 * writes, and what the hook shows when nothing is stored. The rows write
 * exactly those strings, so a screen edited from a phone picks them up as if
 * they had been chosen on it.
 *
 * The screensaver's own settings are not here: its panel (Screensaver motion)
 * and the Screen sheet edit them. Safe zones are synced but not here either:
 * nothing in the app edits them yet.
 */

export type ScreenSettingOption = { raw: string; label: string };

export type ScreenSettingField = {
  key: ScreenSettingKey;
  label: string;
  options: ScreenSettingOption[];
  /** What the screen uses when nothing is stored. */
  fallback: string;
  /** The option the screen is using now, when it is not simply the stored string. */
  read?: (settings: ScreenSettings) => string;
};

const trueFalse: ScreenSettingOption[] = [
  { raw: 'true', label: 'On' },
  { raw: 'false', label: 'Off' },
];

export const SCREEN_SETTING_FIELDS: ScreenSettingField[] = [
  {
    key: 'prism-perf-mode',
    label: 'Performance',
    options: [
      { raw: 'auto', label: 'Auto' },
      { raw: 'full', label: 'Full' },
      { raw: 'reduced', label: 'Reduced' },
      { raw: 'minimal', label: 'Minimal' },
    ],
    fallback: 'auto',
    // The old on/off values still mean what they did.
    read: (settings) => modeFrom(settings['prism-perf-mode'] ?? null),
  },
  {
    key: 'prism:keyboard-on-this-device',
    label: 'On-screen keyboard',
    // Stored as JSON, quotes and all.
    options: [
      { raw: '"household"', label: 'Use household setting' },
      { raw: '"always"', label: 'Always' },
      { raw: '"never"', label: 'Never' },
    ],
    fallback: '"household"',
  },
  {
    key: 'prism-orientation-override',
    label: 'Orientation',
    options: [
      { raw: 'auto', label: 'Detect' },
      { raw: 'landscape', label: 'Landscape' },
      { raw: 'portrait', label: 'Portrait' },
    ],
    fallback: 'auto',
  },
  {
    key: 'prism:auto-hide-ui',
    label: 'Auto-hide navigation',
    options: trueFalse,
    fallback: 'false',
  },
  {
    key: 'prism-idle-logout-minutes',
    label: 'Sign out after',
    options: IDLE_LOGOUT_OPTIONS.map((o) => ({ raw: String(o.value), label: o.value === 0 ? 'Never' : `${o.label} untouched` })),
    fallback: String(DEFAULT_IDLE_LOGOUT_MINUTES),
  },
];

/** The option the screen is using: its stored value if it is one of them, else what it falls back to. */
export function currentOption(field: ScreenSettingField, settings: ScreenSettings): string {
  const raw = field.read ? field.read(settings) : settings[field.key];
  return raw !== undefined && field.options.some((o) => o.raw === raw) ? raw : field.fallback;
}

/** What to send when `raw` is picked for `field`. */
export function changesFor(field: ScreenSettingField, raw: string): ScreenSettingChanges {
  return { [field.key]: raw };
}
