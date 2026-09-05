import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { BUILTIN_THEMES, getBuiltinTheme, DEFAULT_THEME_ID } from './appThemes';
import { isInstallableTheme, type Theme } from './tokens';

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
