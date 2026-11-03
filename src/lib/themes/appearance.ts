/**
 * Appearance: which overall look the household uses (Prism 2.0, #799).
 *
 *  - classic: the look every install had before 2.0. Opaque cards over a photo
 *    dimmed by a flat black layer, and the larger text steps on wall screens.
 *  - v2: smoked-glass cards the photo shows through, a top bar and side rail
 *    with no background of their own, dimming only where text sits, and a
 *    smaller text step on wall screens.
 *
 * One household setting, not per screen: it is a choice about how the home's
 * screens look, like the palette, and the palette is household-wide too.
 *
 * A missing row means v2. Installs that existed before this setting were given
 * an explicit `classic` row by migration 0041, so only new installs reach the
 * default.
 *
 * Not a client module: app/layout.tsx is a server component and inlines
 * APPEARANCE_SCRIPT.
 */

export type Appearance = 'classic' | 'v2';

/** The settings row. */
export const APPEARANCE_SETTING = 'appearance';

/** What a household with no row gets: a new install. */
export const DEFAULT_APPEARANCE: Appearance = 'v2';

/**
 * The last value this browser saw, for first paint on a load where the server
 * could not read the database. Never the source of truth.
 */
export const APPEARANCE_STORAGE_KEY = 'prism-appearance';

/** The attribute on <html> that the stylesheet keys on. */
export const APPEARANCE_ATTR = 'data-appearance';

export function isAppearance(v: unknown): v is Appearance {
  return v === 'classic' || v === 'v2';
}

/** The value a settings row holds, or the default when there is none. */
export function appearanceFromRow(value: unknown, hasRow: boolean): Appearance {
  if (!hasRow) return DEFAULT_APPEARANCE;
  return isAppearance(value) ? value : 'classic';
}

/** Set the look on this page now and remember it for the next first paint. */
export function applyAppearance(value: Appearance): void {
  document.documentElement.setAttribute(APPEARANCE_ATTR, value);
  try {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, value);
  } catch {
    // Site data blocked: the server still renders the right value next load.
  }
}

/**
 * Inlined in the blocking <head> script. The server normally renders the
 * attribute; this only fills it in when the server could not (database down),
 * from what this browser saw last, and otherwise records what the server sent.
 */
export const APPEARANCE_SCRIPT =
  `var r=document.documentElement,a=r.getAttribute('${APPEARANCE_ATTR}');` +
  `if(a){localStorage.setItem('${APPEARANCE_STORAGE_KEY}',a)}` +
  `else{r.setAttribute('${APPEARANCE_ATTR}',localStorage.getItem('${APPEARANCE_STORAGE_KEY}')==='v2'?'v2':'classic')}`;
