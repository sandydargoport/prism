/**
 * The two theme axes that are not colours and not numbers.
 *
 * A font is a *role* chosen from a list here, never a family name from the
 * payload — a family name is a string that would reach a CSS declaration, and
 * a face has to be in the image to work at all.
 *
 * A mode is the safest thing a theme can set: it picks a name, and what the
 * name means is decided in this repository. So the tests worth having are
 * about what happens to a name that is not on the list, and about a theme that
 * says nothing still rendering exactly as it did before either axis existed.
 */
import {
  isValidFont, normalizeFont, isValidModes, normalizeModes,
  isInstallableTheme, THEME_FONTS, THEME_MODES, type Theme, type ThemeTokens,
} from '../tokens';
import { themeCss } from '../applyTheme';
import { THEME_TOKENS } from '../tokens';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getBuiltinTheme } from '../appThemes';
import { checkThemeContrast } from '../contrast';

const tokens = (): ThemeTokens =>
  Object.fromEntries(THEME_TOKENS.map((t) => [t, '210 40% 50%'])) as ThemeTokens;

const theme = (extra: Partial<Theme> = {}): Theme => ({
  id: 't', name: 'T', description: 'd', light: tokens(), dark: tokens(), ...extra,
});

describe('font role', () => {
  it('accepts every role it offers', () => {
    for (const role of Object.keys(THEME_FONTS)) expect(isValidFont(role)).toBe(true);
  });

  it('refuses a family name', () => {
    expect(isValidFont('Comic Sans MS')).toBe(false);
    expect(isValidFont('Inter')).toBe(false);
  });

  it('refuses an inherited property masquerading as a role', () => {
    expect(isValidFont('constructor')).toBe(false);
    expect(isValidFont('__proto__')).toBe(false);
    expect(isValidFont('toString')).toBe(false);
  });

  it('falls back to sans rather than rejecting', () => {
    expect(normalizeFont('nonsense')).toBe('sans');
    expect(normalizeFont(undefined)).toBe('sans');
    expect(normalizeFont('serif')).toBe('serif');
  });

  it('never puts a submitted string into the stylesheet', () => {
    // Cast through unknown deliberately: the type forbids this, and the point
    // of the test is what happens when something that is not type-checked —
    // a parsed submission — carries it anyway.
    const css = themeCss(theme({ font: 'attack"; } body { display: none' } as unknown as Partial<Theme>));
    expect(css).not.toContain('display: none');
    expect(css).toContain('--theme-font:var(--font-inter)');
  });

  it('emits the variable for the role it was given', () => {
    expect(themeCss(theme({ font: 'mono' }))).toContain('var(--font-mono-theme)');
  });
});

describe('display modes', () => {
  it('accepts a listed option', () => {
    expect(isValidModes({ events: 'compact' })).toBe(true);
    expect(isValidModes({ events: 'compact', surface: 'flat' })).toBe(true);
  });

  it('accepts a theme that sets none of them', () => {
    expect(isValidModes(undefined)).toBe(true);
    expect(isValidModes({})).toBe(true);
  });

  it('refuses an option that is not on the list', () => {
    expect(isValidModes({ events: 'cramped' })).toBe(false);
    expect(isValidModes({ surface: 'glass' })).toBe(false);
  });

  it('defaults each key independently, so one bad value keeps the others', () => {
    expect(normalizeModes({ events: 'compact', surface: 'nonsense' }))
      .toEqual({ events: 'compact', surface: 'card' });
  });

  it('resolves to defaults when absent', () => {
    expect(normalizeModes(undefined)).toEqual({ events: 'comfortable', surface: 'card' });
  });

  it('turns a mode into the properties this repo decided it means', () => {
    const comfortable = themeCss(theme({ modes: { events: 'comfortable' } }));
    const compact = themeCss(theme({ modes: { events: 'compact' } }));
    expect(comfortable).toContain('--event-font-size:0.75rem');
    expect(compact).toContain('--event-font-size:0.6875rem');
    expect(compact).toContain('--event-padding-y:0');
  });

  it('emits every mode group whatever the theme says, so nothing is left stale', () => {
    // A theme switching from compact back to comfortable has to overwrite the
    // properties the previous one set, not merely stop setting them — a
    // property that stops being emitted keeps its old value on the element.
    const compact = themeCss(theme({ modes: { events: 'compact', surface: 'flat' } }));
    const silent = themeCss(theme());
    for (const prop of ['--event-padding-x', '--event-padding-y', '--event-gap',
                        '--event-font-size', '--surface-shadow']) {
      expect(compact).toContain(prop);
      expect(silent).toContain(prop);
    }
    expect(Object.keys(THEME_MODES)).toEqual(['events', 'surface']);
  });
});

describe('a theme that sets neither', () => {
  it('still validates and installs', () => {
    expect(isInstallableTheme(theme())).toBe(true);
  });

  it('renders the same values the hard-coded classes used', () => {
    const css = themeCss(theme());
    expect(css).toContain('--event-padding-x:0.25rem');
    expect(css).toContain('--event-font-size:0.75rem');
    expect(css).toContain('--theme-font:var(--font-inter)');
  });
});

describe('stored themes', () => {
  it('refuses a stored theme carrying an unknown mode', () => {
    expect(isInstallableTheme({ ...theme(), modes: { events: 'cramped' } })).toBe(false);
  });

  it('refuses a stored theme carrying an unknown font role', () => {
    expect(isInstallableTheme({ ...theme(), font: 'Papyrus' })).toBe(false);
  });
});

describe('Notice Board', () => {
  /**
   * The built-in that exists to exercise the two new axes rather than to add
   * another palette. If it stops setting them, they have no worked example in
   * the box and the next theme author has nothing to copy.
   */
  const noticeBoard = getBuiltinTheme('notice-board')!;

  it('is the built-in that uses both new axes', () => {
    expect(noticeBoard.font).toBe('rounded');
    expect(noticeBoard.modes).toEqual({ events: 'compact', surface: 'flat' });
  });

  it('is borderless on purpose', () => {
    expect(noticeBoard.shape?.borderWidth).toBe(0);
  });

  it('has no unreadable text pairs', () => {
    const { errors, warnings } = checkThemeContrast(noticeBoard);
    expect(errors).toEqual([]);
    // Its only warnings are the hairline grid, which is the design. A text
    // warning here would mean the near-white surfaces went too far.
    expect(warnings.every((w) => w.kind === 'edge')).toBe(true);
  });

  it('renders compact spacing rather than the defaults', () => {
    const css = themeCss(noticeBoard);
    expect(css).toContain('--event-padding-y:0');
    expect(css).toContain('--surface-shadow:none');
    expect(css).toContain('var(--font-rounded)');
  });
});

describe('the modes reach real components', () => {
  /**
   * A mode that emits properties nothing reads is dead data dressed as a
   * feature, which is the reason the gallery refuses to adopt a fork's extra
   * tokens. The same standard has to apply to what we add ourselves, so this
   * asserts the consuming classes exist rather than trusting that they do.
   */
  const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf-8');

  it('every property a mode sets is consumed somewhere', () => {
    const sources = [
      'src/components/ui/card.tsx',
      'src/components/calendar/cells/InlineCalendarEvent.tsx',
      'src/components/calendar/MonthView.tsx',
      'src/components/calendar/ThreeMonthView.tsx',
      'src/components/calendar/MultiWeekView.tsx',
      'src/components/calendar/TwoWeekView.tsx',
      'src/components/calendar/AgendaView.tsx',
    ].map(read).join('\n');

    const emitted = new Set<string>();
    for (const css of [themeCss(theme({ modes: { events: 'compact', surface: 'flat' } })),
                       themeCss(theme())]) {
      for (const m of css.matchAll(/(--(?:event|agenda|surface)-[a-z-]+):/g)) emitted.add(m[1]!);
    }

    expect(emitted.size).toBeGreaterThan(0);
    for (const prop of emitted) {
      expect(sources).toContain(`var(${prop})`);
    }
  });

  it('leaves the size-driven compact prop alone', () => {
    // The `compact` prop means "this cell is small". The theme mode means "this
    // house likes it tight". Collapsing the two would let a theme override a
    // decision the layout made about available space.
    const chip = read('src/components/calendar/cells/InlineCalendarEvent.tsx');
    expect(chip).toContain("compact ? 'px-0.5 py-px text-[8px]'");
  });
});
