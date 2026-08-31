/**
 * Turning a theme into CSS, on the client and on the server.
 */
import { THEME_TOKENS, isValidTokenValue, type Theme, type ThemeTokens } from './tokens';

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

/** Remove every theme token, falling back to the values in globals.css. */
export function clearThemeVars(root: HTMLElement): void {
  for (const token of THEME_TOKENS) root.style.removeProperty(`--${token}`);
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

  return `:root{${block(theme.light)}}.dark{${block(theme.dark)}}`;
}
