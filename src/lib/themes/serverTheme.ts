import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { BUILTIN_THEMES, getBuiltinTheme, DEFAULT_THEME_ID } from './appThemes';
import { isInstallableTheme, type Theme } from './tokens';
import { DEFAULT_MODE_SETTING_KEY, isDefaultMode, type DefaultMode } from '@/lib/looks';
import { SCREEN_SETTING_KEYS } from '@/lib/displays/screenSettings';

/**
 * Where the editor page puts the screen being edited, for its frame (#1153).
 * The same word as REMOTE_EDIT_GLOBAL in remoteEdit.ts, which is a client
 * module this server code cannot read a value from; a test keeps them equal.
 */
export const FIRST_PAINT_HOST_GLOBAL = '__prismRemoteEdit';

const THEME_SETTING_KEY = 'theme';

/**
 * The palette to render on the server, so the first paint is already correct.
 *
 * The client provider applies palettes too, but only after mount. Relying on
 * that alone means every load of a wall display flashes the default palette
 * before settling — brief, but on a screen that reloads on its own it is the
 * most visible thing about the feature, and it reads as a fault rather than a
 * transition.
 *
 * Failure returns the default rather than throwing. A database that is briefly
 * unavailable should cost the wrong colours for one paint, not a blank page —
 * the same trade the per-display font scale already makes.
 */
export async function getServerTheme(): Promise<Theme> {
  const fallback = getBuiltinTheme(DEFAULT_THEME_ID) ?? BUILTIN_THEMES[0]!;
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, THEME_SETTING_KEY));
    const value = row?.value as { paletteId?: unknown; installed?: unknown } | undefined;
    if (typeof value?.paletteId !== 'string') return fallback;
    const builtin = getBuiltinTheme(value.paletteId);
    if (builtin) return builtin;
    // Gallery themes live under `installed`, which this never consulted: an
    // installed palette rendered as the default server-side and was only
    // corrected at mount, so every reload flashed the wrong colours — the exact
    // failure the comment above says the design prevents, for the one class of
    // theme a person chose deliberately. Re-validated here for the same reason
    // the client re-validates: it is the last point before this becomes CSS.
    const installed = Array.isArray(value.installed)
      ? (value.installed as unknown[]).filter(isInstallableTheme)
      : [];
    return installed.find((t) => t.id === value.paletteId) ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * The household's default light or dark mode, for displays that never chose
 * one (#808: the Night look). A display's own choice, in localStorage, always
 * wins. Missing, unknown or unreadable is 'system', as before.
 */
export async function getServerDefaultMode(): Promise<DefaultMode> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, DEFAULT_MODE_SETTING_KEY));
    return isDefaultMode(row?.value) ? row.value : 'system';
  } catch {
    return 'system';
  }
}

/**
 * The blocking script that sets the dark and performance classes before the
 * first paint. `defaultMode` is one of three fixed words (checked above), so it
 * is safe to place in the script.
 *
 * In the editor's frame for a named screen (#1340), the screen's own settings
 * are read from the editor page, as remoteEdit's storage does once the app
 * runs: a Light screen edited on a laptop set to dark paints light from the
 * first frame, and so does its performance class. A screen key the screen
 * has not set reads as unset there, never as the laptop's own value.
 */
export function firstPaintScript(defaultMode: DefaultMode, perfScript: string): string {
  const fallback = isDefaultMode(defaultMode) ? defaultMode : 'system';
  const keys = JSON.stringify(SCREEN_SETTING_KEYS);
  const store =
    `var s=localStorage;try{var h=window.parent!==window&&window.parent['${FIRST_PAINT_HOST_GLOBAL}'];` +
    `if(h&&h.displayId){var v=h.settings||{},k=${keys};` +
    `s={getItem:function(n){return k.indexOf(n)<0?localStorage.getItem(n):typeof v[n]==='string'?v[n]:null}}}}catch(e){}`;
  return `(function(){try{${store}(function(localStorage){var t=localStorage.getItem('prism-theme')||'${fallback}';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');${perfScript}})(s)}catch(e){}})()`;
}
