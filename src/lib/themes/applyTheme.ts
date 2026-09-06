/**
 * Turning a theme into CSS, on the client and on the server.
 */
import {
  THEME_TOKENS, isValidTokenValue, normalizeShape, normalizeFont, normalizeModes,
  THEME_FONTS, type Theme, type ThemeTokens,
} from './tokens';

export type ResolvedMode = 'light' | 'dark';

export function themeTokens(theme: Theme, mode: ResolvedMode): ThemeTokens {
  return mode === 'dark' ? theme.dark : theme.light;
}

/**
 * Write a token set onto an element.
 *
 * Removes before setting. A theme that omits a token would otherwise inherit
 * whatever the previous theme left behind — switching from a theme that
 * defines `--ring` to one that does not would leave the old ring colour stuck
 * until reload, which looks like a rendering bug rather than a missing value.
 *
 * Values are re-checked here even though they were checked on the way in.
 * This is the last point before the DOM, and the cost is a regex per token.
 */
export function applyThemeVars(root: HTMLElement, tokens: Partial<ThemeTokens>): void {
  for (const token of THEME_TOKENS) {
    const value = tokens[token];
    if (isValidTokenValue(value)) {
      root.style.setProperty(`--${token}`, value);
    } else {
      root.style.removeProperty(`--${token}`);
    }
  }
}

/**
 * Apply everything a theme sets that is not a colour: shape, typeface, modes.
 *
 * All of it lands as custom properties, for the same reason the colours do —
 * the server can render the identical set into a stylesheet, so the first
 * paint is already right. A mode expressed as React state instead would be
 * correct only after mount, which on a wall display means every reload shows
 * the wrong density for a beat.
 */
export function applyThemeChrome(root: HTMLElement, theme: Theme): void {
  for (const [prop, value] of chromeProperties(theme)) {
    root.style.setProperty(prop, value);
  }
}

/**
 * Shape as CSS custom properties.
 *
 * Density is a multiplier rather than a length so it can scale the existing
 * spacing scale instead of replacing it — a theme says "roomier", not "16px",
 * and stays correct wherever it is applied.
 */
function shapeProperties(theme: Theme): Array<[string, string]> {
  const { radius, density, borderWidth } = normalizeShape(theme.shape);
  return [
    ['--radius', `${radius}rem`],
    ['--density', String(density)],
    ['--border-width', `${borderWidth}px`],
  ];
}

/**
 * What each mode actually means, in one table.
 *
 * The values live here rather than in the theme, which is the whole point of a
 * mode: a submission picks a name and this repository decides what the name
 * does. Changing how `compact` looks is a change here, and every theme that
 * asked for it follows along.
 */
const MODE_PROPERTIES = {
  events: {
    // Two scales, because an agenda row and a chip in a month cell are not the
    // same object. Tightening a list to a month cell's spacing collapses it
    // into an unreadable block, so the agenda values move by proportion rather
    // than to the same numbers.
    comfortable: {
      '--event-padding-x': '0.25rem',
      '--event-padding-y': '0.125rem',
      '--event-gap': '0.125rem',
      '--event-font-size': '0.75rem',
      '--agenda-row-padding': '0.375rem',
      '--agenda-row-gap': '0.375rem',
      '--agenda-group-gap': '1rem',
    },
    // Tight enough to fit a full family's week in a month cell, which is what
    // a shared wall calendar is actually for.
    compact: {
      '--event-padding-x': '0.1875rem',
      '--event-padding-y': '0',
      '--event-gap': '0.0625rem',
      '--event-font-size': '0.6875rem',
      '--agenda-row-padding': '0.1875rem',
      '--agenda-row-gap': '0.125rem',
      '--agenda-group-gap': '0.625rem',
    },
  },
  surface: {
    card: { '--surface-shadow': '0 1px 2px 0 rgb(0 0 0 / 0.05)' },
    flat: { '--surface-shadow': 'none' },
  },
} as const;

function chromeProperties(theme: Theme): Array<[string, string]> {
  const modes = normalizeModes(theme.modes);
  const modeVars = Object.entries(MODE_PROPERTIES).flatMap(([key, byOption]) => {
    const chosen = (byOption as Record<string, Record<string, string>>)[modes[key as keyof typeof modes]];
    return Object.entries(chosen ?? {});
  });

  // The face is named by role; the variable behind the role is ours. A theme
  // never supplies a family name, so nothing submitted reaches this string.
  const font = THEME_FONTS[normalizeFont(theme.font)].varName;

  return [
    ...shapeProperties(theme),
    ['--theme-font', `var(${font}), var(--font-inter, Inter)`],
    ...modeVars,
  ];
}

/** Remove every theme token, falling back to the values in globals.css. */
export function clearThemeVars(root: HTMLElement): void {
  for (const token of THEME_TOKENS) root.style.removeProperty(`--${token}`);
  for (const [prop] of chromeProperties({ light: {}, dark: {} } as Theme)) {
    root.style.removeProperty(prop);
  }
}

/**
 * A stylesheet for server rendering, so the first paint is already themed.
 *
 * Built by iterating THEME_TOKENS and emitting only values that pass the
 * triple check — never by serialising the theme object. That matters more here
 * than on the client: `setProperty` goes through the CSSOM, which cannot be
 * escaped out of, but this string lands inside a `<style>` element where a
 * closing tag in a value would end the block and begin markup. There is no CSP
 * in this app to catch that.
 *
 * The shape of this function is the guarantee. Anything not in THEME_TOKENS
 * cannot appear in the output, whatever the input contains.
 */
export function themeCss(theme: Theme): string {
  const block = (tokens: ThemeTokens) =>
    THEME_TOKENS.filter((t) => isValidTokenValue(tokens[t]))
      .map((t) => `--${t}:${tokens[t]}`)
      .join(';');

  // Shape, typeface and modes sit on :root only — none of them differ between
  // light and dark, and repeating them under .dark would just be a second
  // place to keep in step.
  const chrome = chromeProperties(theme).map(([p, v]) => `${p}:${v}`).join(';');
  return `:root{${block(theme.light)};${chrome}}.dark{${block(theme.dark)}}`;
}
