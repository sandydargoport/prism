/**
 * @jest-environment jsdom
 */
/**
 * Themes are data, and data can arrive from a community gallery. So the tests
 * that matter most are the ones proving a hostile value cannot become CSS.
 */
import { THEME_TOKENS, isValidTokenValue, isValidTokenSet } from '../tokens';
import { BUILTIN_THEMES, getBuiltinTheme, DEFAULT_THEME_ID } from '../appThemes';
import { applyThemeVars, clearThemeVars, themeCss, themeTokens } from '../applyTheme';
import { checkContrast, checkThemeContrast } from '../contrast';

describe('isValidTokenValue', () => {
  it('accepts a bare HSL triple, which is what Tailwind expects', () => {
    // hsl(var(--x)) supplies the wrapper; that is what makes bg-primary/40 work.
    expect(isValidTokenValue('222 47% 11%')).toBe(true);
    expect(isValidTokenValue('0 0% 100%')).toBe(true);
    expect(isValidTokenValue('212.5 95% 68.2%')).toBe(true);
  });

  it('rejects anything that could carry more than a colour', () => {
    for (const hostile of [
      'red; background: url(https://example.com/x)',
      'var(--background)',
      'calc(100% - 1px)',
      'url(https://example.com/pixel.gif)',
      '222 47% 11%; }</style><script>alert(1)</script>',
      'expression(alert(1))',
      '#ffffff',
      'rgb(0,0,0)',
      'white',
    ]) {
      expect(isValidTokenValue(hostile)).toBe(false);
    }
  });

  it('rejects out-of-range numbers even when the shape is right', () => {
    expect(isValidTokenValue('400 47% 11%')).toBe(false);
    expect(isValidTokenValue('222 147% 11%')).toBe(false);
    expect(isValidTokenValue('222 47% 111%')).toBe(false);
  });

  it('rejects non-strings', () => {
    for (const v of [null, undefined, 42, {}, []]) expect(isValidTokenValue(v)).toBe(false);
  });
});

describe('isValidTokenSet', () => {
  it('requires every token, so a partial theme cannot half-apply', () => {
    const partial = Object.fromEntries(THEME_TOKENS.slice(0, 5).map((t) => [t, '0 0% 50%']));
    expect(isValidTokenSet(partial)).toBe(false);
  });

  it('accepts a complete valid set', () => {
    const full = Object.fromEntries(THEME_TOKENS.map((t) => [t, '0 0% 50%']));
    expect(isValidTokenSet(full)).toBe(true);
  });

  it('rejects a set where one value is hostile', () => {
    const full = Object.fromEntries(THEME_TOKENS.map((t) => [t, '0 0% 50%']));
    full.background = 'red; background: url(https://example.com)';
    expect(isValidTokenSet(full)).toBe(false);
  });
});

describe('built-in themes', () => {
  it('all pass their own validator', () => {
    for (const theme of BUILTIN_THEMES) {
      expect(isValidTokenSet(theme.light)).toBe(true);
      expect(isValidTokenSet(theme.dark)).toBe(true);
    }
  });

  it('includes the default, so nothing has to special-case it', () => {
    expect(getBuiltinTheme(DEFAULT_THEME_ID)).toBeDefined();
  });

  it('has unique ids', () => {
    const ids = BUILTIN_THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('applyThemeVars', () => {
  let root: HTMLElement;
  beforeEach(() => { root = document.createElement('div'); });

  it('sets every token', () => {
    applyThemeVars(root, themeTokens(BUILTIN_THEMES[0]!, 'light'));
    expect(root.style.getPropertyValue('--background')).toBe('0 0% 100%');
  });

  it('removes a token the incoming theme omits', () => {
    // The bug this prevents: switch to a theme without --ring and the old
    // ring colour stays stuck, which reads as a rendering fault.
    applyThemeVars(root, { ring: '10 20% 30%' });
    expect(root.style.getPropertyValue('--ring')).toBe('10 20% 30%');

    applyThemeVars(root, { background: '0 0% 0%' });
    expect(root.style.getPropertyValue('--ring')).toBe('');
  });

  it('refuses a hostile value rather than passing it to the DOM', () => {
    applyThemeVars(root, { background: 'red; content: url(https://example.com)' } as never);
    expect(root.style.getPropertyValue('--background')).toBe('');
  });

  it('clearThemeVars falls back to the stylesheet', () => {
    applyThemeVars(root, themeTokens(BUILTIN_THEMES[0]!, 'dark'));
    clearThemeVars(root);
    expect(root.style.getPropertyValue('--background')).toBe('');
  });
});

describe('themeCss', () => {
  it('emits both modes', () => {
    const css = themeCss(BUILTIN_THEMES[0]!);
    expect(css).toContain(':root{');
    expect(css).toContain('.dark{');
    expect(css).toContain('--background:0 0% 100%');
  });

  it('cannot be escaped out of, even by a crafted value', () => {
    // This is the one that matters: the client path goes through the CSSOM,
    // which cannot be escaped. This string lands inside a <style> element,
    // and there is no CSP in this app to catch a break-out.
    const evil = {
      ...BUILTIN_THEMES[0]!,
      light: { ...BUILTIN_THEMES[0]!.light, background: '0 0% 0%}</style><script>alert(1)</script>' },
    };
    const css = themeCss(evil);
    expect(css).not.toContain('</style>');
    expect(css).not.toContain('<script>');
  });

  it('omits a token rather than emitting an invalid value', () => {
    const partial = {
      ...BUILTIN_THEMES[0]!,
      dark: { ...BUILTIN_THEMES[0]!.dark, ring: 'not-a-colour' },
    };
    expect(themeCss(partial)).not.toContain('not-a-colour');
  });

  it('never emits a property name that is not in the allowlist', () => {
    const smuggled = {
      ...BUILTIN_THEMES[0]!,
      light: { ...BUILTIN_THEMES[0]!.light, 'background-image': '0 0% 0%' },
    };
    expect(themeCss(smuggled as never)).not.toContain('background-image');
  });
});

describe('legibility', () => {
  // This is the enforcement. A theme that fails cannot be merged, which means
  // the check runs on every built-in and, later, on every gallery submission —
  // rather than depending on whoever authored it having looked carefully.
  it.each(BUILTIN_THEMES.map((t) => [t.name, t] as const))(
    '%s is readable in both modes',
    (_name, theme) => {
      const { errors } = checkThemeContrast(theme);
      expect(errors.map((e) => `${e.pair} = ${e.ratio.toFixed(2)}`)).toEqual([]);
    },
  );

  it('rejects text that cannot be read', () => {
    const base = BUILTIN_THEMES[0]!.light;
    const unreadable = { ...base, foreground: '0 0% 96%', background: '0 0% 100%' };
    const issues = checkContrast(unreadable);
    expect(issues.some((i) => i.level === 'error' && i.pair.startsWith('foreground'))).toBe(true);
  });

  it('warns rather than blocks on a borderless look', () => {
    // A theme with invisible borders is a style choice. One with invisible
    // text is not, and the two must not be treated the same.
    const base = BUILTIN_THEMES[0]!.light;
    const borderless = { ...base, border: base.background };
    const issues = checkContrast(borderless);
    const edge = issues.filter((i) => i.pair.includes('border'));
    expect(edge.length).toBeGreaterThan(0);
    expect(edge.every((i) => i.level === 'warning')).toBe(true);
  });

  it('flags a merely-tiring pair as a warning, not an error', () => {
    const base = BUILTIN_THEMES[0]!.light;
    const dim = { ...base, 'muted-foreground': '0 0% 55%', muted: '0 0% 100%' };
    const issues = checkContrast(dim).filter((i) => i.pair.startsWith('muted-foreground'));
    expect(issues[0]?.level).toBe('warning');
  });
});
