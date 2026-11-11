/**
 * The sign-out timer's key and choices, apart from the hook so the screen's
 * settings table (screenSettingFields) can list them without pulling in React
 * providers.
 */

/** Minutes of inactivity before the display signs itself out. */
export const IDLE_LOGOUT_KEY = 'prism-idle-logout-minutes';
export const DEFAULT_IDLE_LOGOUT_MINUTES = 30;

export const IDLE_LOGOUT_OPTIONS = [
  { value: 0, label: 'Never' },
  { value: 5, label: '5 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 240, label: '4 hours' },
] as const;
