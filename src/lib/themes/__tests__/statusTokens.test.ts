import {
  OPTIONAL_THEME_TOKENS, ALL_THEME_TOKENS, THEME_TOKENS,
  isValidTokenSet, type ThemeTokens,
} from '../tokens';
import { themeCss } from '../applyTheme';
import { checkContrast } from '../contrast';

/** A valid required set, so each test can vary only the optional tokens. */
function baseTokens(): ThemeTokens {
  const t = {} as Record<string, string>;
  for (const token of THEME_TOKENS) t[token] = '0 0% 50%';
  return t as ThemeTokens;
}

describe('optional status tokens', () => {
  it('accepts a theme that sets none of them, so older themes stay valid', () => {
    expect(isValidTokenSet(baseTokens())).toBe(true);
  });

  it('accepts a theme that sets them with valid triples', () => {
    const t = { ...baseTokens(), success: '142 72% 29%', 'success-foreground': '0 0% 100%' };
    expect(isValidTokenSet(t)).toBe(true);
  });

  it('rejects a malformed optional value rather than letting it through unchecked', () => {
    const t = { ...baseTokens(), warning: 'red' } as unknown;
    expect(isValidTokenSet(t)).toBe(false);
  });

  it('refuses anything that is not a bare triple, including a var() reference', () => {
    const t = { ...baseTokens(), warning: 'var(--x)' } as unknown;
    expect(isValidTokenSet(t)).toBe(false);
  });

  it('emits an optional token into the server stylesheet when set', () => {
    const light = { ...baseTokens(), warning: '32 95% 34%' };
    const css = themeCss({ id: 'a', name: 'A', description: '', light, dark: light });
    expect(css).toContain('--warning:32 95% 34%');
  });

  it('omits it entirely when unset, so the globals.css default stands', () => {
    const light = baseTokens();
    const css = themeCss({ id: 'a', name: 'A', description: '', light, dark: light });
    expect(css).not.toContain('--warning');
    expect(css).not.toContain('--success');
  });

  it('is listed in ALL_THEME_TOKENS but not in the required set', () => {
    for (const token of OPTIONAL_THEME_TOKENS) {
      expect(ALL_THEME_TOKENS).toContain(token);
      expect(THEME_TOKENS as readonly string[]).not.toContain(token);
    }
  });
});

describe('contrast of status pairs', () => {
  it('says nothing about a pair the theme did not set', () => {
    const issues = checkContrast(baseTokens());
    expect(issues.some((i) => i.pair.includes('success'))).toBe(false);
  });

  it('flags an unreadable pair the theme did set', () => {
    const t = { ...baseTokens(), success: '142 72% 29%', 'success-foreground': '142 72% 31%' };
    const issues = checkContrast(t);
    expect(issues.some((i) => i.pair === 'success-foreground on success' && i.level === 'error')).toBe(true);
  });

  it('passes a pair with real separation', () => {
    const t = { ...baseTokens(), success: '142 72% 29%', 'success-foreground': '0 0% 100%' };
    const issues = checkContrast(t);
    expect(issues.some((i) => i.pair.includes('success'))).toBe(false);
  });

  it('ignores a half-set pair rather than measuring against a default the theme did not choose', () => {
    const t = { ...baseTokens(), warning: '32 95% 34%' };
    const issues = checkContrast(t);
    expect(issues.some((i) => i.pair.includes('warning'))).toBe(false);
  });
});
