/**
 * Turning a theme into CSS, on the client and on the server.
 */
import { THEME_TOKENS, isValidTokenValue, normalizeShape, type Theme, type ThemeTokens } from './tokens';

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

/** Apply the shape values, which are the same in both modes. */
export function applyThemeShape(root: HTMLElement, theme: Theme): void {
  for (const [prop, value] of shapeProperties(theme)) {
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

/** Remove every theme token, falling back to the values in globals.css. */
export function clearThemeVars(root: HTMLElement): void {
  for (const token of THEME_TOKENS) root.style.removeProperty(`--${token}`);
  for (const [prop] of shapeProperties({ light: {}, dark: {} } as Theme)) {
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

  // Shape sits on :root only — it does not differ between modes, and repeating
  // it under .dark would just be a second place to keep in step.
  const shape = shapeProperties(theme).map(([p, v]) => `${p}:${v}`).join(';');
  return `:root{${block(theme.light)};${shape}}.dark{${block(theme.dark)}}`;
}
