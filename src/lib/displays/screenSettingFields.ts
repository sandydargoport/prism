import { normalise as normaliseMotion } from '@/components/screensaver/useScreensaverMotion';
import { DEFAULT_DIM_HOURS, DEFAULT_DIM_LEVEL, DIM_HOURS, DIM_LEVELS, dimLevel } from '@/components/screensaver/idleDim';
import type { ScreenSettingChanges, ScreenSettingKey, ScreenSettings } from './screenSettings';

/**
 * The settings of ANOTHER screen, as a form a phone can fill in (#690).
 *
 * The screen's own Settings pages write these values straight into its
 * browser, so they cannot be pointed at a different screen. This table
 * describes each one instead: which stored key, the raw strings its hook
 * writes, and what the hook shows when nothing is stored. The form writes
 * exactly those strings to the screen's row, and the screen picks them up as
 * if they had been chosen on it.
 *
 * Safe zones are synced but not here: nothing in the app edits them yet.
 */

export type ScreenSettingOption = { raw: string; label: string };

export type ScreenSettingField = {
  key: ScreenSettingKey;
  label: string;
  group: 'Screensaver' | 'Screen';
  options: ScreenSettingOption[];
  /** What the screen uses when nothing is stored. */
  fallback: string;
  /** The option the screen is using now, when it is not simply the stored string. */
  read?: (settings: ScreenSettings) => string;
  /** Other keys the screen's own control writes alongside this one. */
  alsoSet?: ScreenSettingChanges;
  /** Shown only when it does something, as on the screen's own page. */
  showIf?: (settings: ScreenSettings) => boolean;
};

const seconds = (pairs: [number, string][]): ScreenSettingOption[] =>
  pairs.map(([n, label]) => ({ raw: String(n), label }));

const onOff = (on: string, off: string): ScreenSettingOption[] => [
  { raw: 'on', label: on },
  { raw: 'off', label: off },
];

const trueFalse: ScreenSettingOption[] = [
  { raw: 'true', label: 'On' },
  { raw: 'false', label: 'Off' },
];

const MOTION = 'prism-screensaver-motion';
const MOTION_MIGRATED = 'prism-screensaver-motion-v2';

function motionOf(settings: ScreenSettings): string {
  return normaliseMotion(settings[MOTION] ?? null, settings[MOTION_MIGRATED] === '1') ?? 'off';
}

const moving = (s: ScreenSettings) => motionOf(s) !== 'off';
const liquid = (s: ScreenSettings) => motionOf(s) === 'liquid';

export const SCREEN_SETTING_FIELDS: ScreenSettingField[] = [
  {
    key: 'prism-screensaver-timeout',
    label: 'Activate after',
    group: 'Screensaver',
    options: seconds([[30, '30 seconds'], [60, '1 minute'], [120, '2 minutes'], [600, '10 minutes'], [3600, '1 hour'], [0, 'Never']]),
    fallback: '120',
  },
  {
    key: 'prism-screensaver-backdrop',
    label: 'Background',
    group: 'Screensaver',
    options: [
      { raw: 'photos', label: 'Photos' },
      { raw: 'sky', label: 'Night sky' },
      { raw: 'skyAtNight', label: 'Photos by day, night sky after dark' },
    ],
    fallback: 'photos',
  },
  {
    key: MOTION,
    label: 'Widget transition effect',
    group: 'Screensaver',
    options: [
      { raw: 'off', label: 'None' },
      { raw: 'fade', label: 'Fade' },
      { raw: 'smoke', label: 'Smoke' },
      { raw: 'liquid', label: 'Fill and drain' },
      { raw: 'fireworks', label: 'Fireworks' },
    ],
    fallback: 'off',
    read: motionOf,
    // Marks the name as current, so 'smoke' is not read as the old fade.
    alsoSet: { [MOTION_MIGRATED]: '1' },
  },
  {
    key: 'prism-screensaver-motion-interval',
    label: 'Change every',
    group: 'Screensaver',
    options: seconds([[10, '10 seconds'], [20, '20 seconds'], [45, '45 seconds'], [90, '1.5 minutes'], [300, '5 minutes']]),
    fallback: '20',
    showIf: moving,
  },
  {
    key: 'prism-screensaver-min-widgets',
    label: 'Show at least',
    group: 'Screensaver',
    options: [1, 2, 3, 4, 5, 6, 8].map((n) => ({ raw: String(n), label: `${n} widget${n === 1 ? '' : 's'}` })),
    fallback: '2',
    showIf: moving,
  },
  {
    key: 'prism-screensaver-max-widgets',
    label: 'Show at most',
    group: 'Screensaver',
    options: [{ raw: '0', label: 'No limit' }, ...[2, 3, 4, 5, 6, 8, 10, 12].map((n) => ({ raw: String(n), label: `${n} widgets` }))],
    fallback: '0',
    showIf: moving,
  },
  {
    key: 'prism-screensaver-outlines',
    label: 'Widget outlines',
    group: 'Screensaver',
    options: onOff('Show', 'Hide'),
    fallback: 'on',
    showIf: moving,
  },
  {
    key: 'prism-screensaver-speed',
    label: 'Transition length',
    group: 'Screensaver',
    options: [
      { raw: '0.5', label: 'Brisk' },
      { raw: '1', label: 'Normal' },
      { raw: '1.6', label: 'Slow' },
      { raw: '2.4', label: 'Very slow' },
    ],
    fallback: '1',
  },
  {
    key: 'prism-screensaver-carbonation',
    label: 'Carbonation',
    group: 'Screensaver',
    options: onOff('On', 'Off'),
    fallback: 'on',
    showIf: liquid,
  },
  {
    key: 'prism-screensaver-water-clear',
    label: 'Keep text clear of the waterline',
    group: 'Screensaver',
    options: onOff('On', 'Off'),
    fallback: 'off',
    showIf: liquid,
  },
  {
    key: 'prism-screensaver-wobble',
    label: 'Surface wobble',
    group: 'Screensaver',
    options: [
      { raw: '0', label: 'None' },
      { raw: '0.5', label: 'Slight' },
      { raw: '1', label: 'Normal' },
      { raw: '1.8', label: 'Choppy' },
    ],
    fallback: '1',
    showIf: liquid,
  },
  {
    key: 'prism-screensaver-drift',
    label: 'Drift',
    group: 'Screensaver',
    options: onOff('On', 'Off'),
    fallback: 'on',
  },
  {
    key: 'prism-screensaver-dim',
    label: 'Dim when idle',
    group: 'Screensaver',
    options: DIM_LEVELS,
    fallback: DEFAULT_DIM_LEVEL,
  },
  {
    key: 'prism-screensaver-dim-hours',
    label: 'Dim during',
    group: 'Screensaver',
    options: DIM_HOURS,
    fallback: DEFAULT_DIM_HOURS,
    showIf: (s) => dimLevel(s['prism-screensaver-dim'] ?? null) > 0,
  },
  {
    key: 'prism-screensaver-shortcut',
    label: 'Settings shortcut on the screensaver',
    group: 'Screensaver',
    options: onOff('Show', 'Hide'),
    fallback: 'off',
  },
  {
    key: 'prism-screensaver-interval',
    label: 'Rotate photos every',
    group: 'Screensaver',
    options: seconds([
      [5, '5 seconds'], [10, '10 seconds'], [15, '15 seconds'], [30, '30 seconds'], [60, '1 minute'],
      [300, '5 minutes'], [600, '10 minutes'], [3600, '1 hour'], [0, 'Never (static)'],
    ]),
    fallback: '15',
  },
  {
    key: 'prism-perf-mode',
    label: 'Performance mode',
    group: 'Screen',
    options: trueFalse,
    fallback: 'false',
  },
  {
    key: 'prism:keyboard-on-this-device',
    label: 'On-screen keyboard',
    group: 'Screen',
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
    group: 'Screen',
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
    group: 'Screen',
    options: trueFalse,
    fallback: 'false',
  },
];

/** The option the screen is using: its stored value if it is one of them, else what it falls back to. */
export function currentOption(field: ScreenSettingField, settings: ScreenSettings): string {
  const raw = field.read ? field.read(settings) : settings[field.key];
  return raw !== undefined && field.options.some((o) => o.raw === raw) ? raw : field.fallback;
}

/** What to send when `raw` is picked for `field`. */
export function changesFor(field: ScreenSettingField, raw: string): ScreenSettingChanges {
  return { ...field.alsoSet, [field.key]: raw };
}
