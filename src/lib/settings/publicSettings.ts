import { PHOTO_DATE_SETTING, PHOTO_ON_THIS_DAY_SETTING, PHOTO_PLACE_SETTING } from '@/lib/photos/caption';
import { SCENERY_SETTING_KEY } from '@/lib/scenery';

/**
 * The settings a caller who may not change settings gets to read (#809, #1224).
 *
 * GET /api/settings answers the signed-out wall, children, and while the auth
 * wall is off, any caller on the network. A parent reads every row; everyone
 * else gets only the keys below, the ones the wall's own screens read. This is
 * an allowlist on purpose: a key added later stays private until a screen
 * needs it and it is added here.
 *
 * Each key, and the client code that reads it:
 */
const PUBLIC_KEYS = new Set<string>([
  'theme', // ThemeProvider: the palette
  'locale', // LocaleProvider: the UI language
  'timeFormat', // TimeFormatProvider: 12 or 24 hour clock
  'timezone', // TimeFormatProvider, useTimezone: the household zone
  'weekStartsOn', // useWeekStartsOn: calendar and meal views
  'hiddenPages', // useHiddenPages: the Dock
  'dockPages', // useHiddenPages: the Dock
  'calendarHiddenHours', // useHiddenHours: day and week views
  'calendarPastEvents', // usePastEventsMode: agenda and list hide ended events
  'shoppingCategories', // useShoppingCategories: the shopping list
  SCENERY_SETTING_KEY, // useSceneryOn: wallpaper and auto-hide
  PHOTO_DATE_SETTING, // usePhotoSettings: photo caption
  PHOTO_PLACE_SETTING, // usePhotoSettings: photo caption
  PHOTO_ON_THIS_DAY_SETTING, // usePhotoSettings: wallpaper photo pick
  'input.virtualKeyboardEnabled', // useGlobalInput: the on-screen keyboard
  'scanner.soundEnabled', // useGlobalInput: scan beep
  'scanner.soundStyle', // useGlobalInput: scan beep
]);

export function publicSettings(all: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(all)) {
    if (key === 'security') {
      const v = value as { requirePinForEveryChange?: unknown } | null;
      // The wall needs only whether everyday jobs ask for a PIN (#835),
      // read by useEveryday.
      if (v && typeof v === 'object' && 'requirePinForEveryChange' in v) {
        out.security = { requirePinForEveryChange: v.requirePinForEveryChange };
      }
      continue;
    }
    if (PUBLIC_KEYS.has(key)) out[key] = value;
  }
  return out;
}
