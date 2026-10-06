/**
 * A theme passed around as a file. It is as untrusted as a gallery download,
 * so the tests that matter prove it is held to the same checks, and that an
 * import never replaces a palette that is already there.
 */
import { buildThemeFile, parseThemeFile, themeIdFromName } from '../themeFile';
import { validateCommunityTheme } from '../validateTheme';
import { BUILTIN_THEMES } from '@/lib/themes/appThemes';
import { isInstallableTheme } from '@/lib/themes/tokens';

const base = BUILTIN_THEMES[0]!;
const meta = { name: 'Midnight Blue', description: 'Deep blues.', author: 'Someone', tags: 'Dark, calm' };

function fileText(over: Record<string, unknown> = {}) {
  return JSON.stringify({ ...buildThemeFile(base, meta), ...over });
}

describe('buildThemeFile', () => {
  it('produces a file the gallery would accept', () => {
    expect(validateCommunityTheme(buildThemeFile(base, meta)).valid).toBe(true);
  });

  it('trims the text fields and lowercases tags', () => {
    const f = buildThemeFile(base, { ...meta, name: '  Midnight Blue ' });
    expect(f.name).toBe('Midnight Blue');
    expect(f.tags).toEqual(['dark', 'calm']);
  });
});

describe('themeIdFromName', () => {
  it('uses the submission workflow rule', () => {
    expect(themeIdFromName('Midnight Blue!')).toBe('midnight-blue');
  });

  it('refuses a name with no letters or numbers', () => {
    expect(themeIdFromName('!!!')).toBeNull();
  });
});

describe('parseThemeFile', () => {
  it('returns an installable theme for a good file', () => {
    const r = parseThemeFile(fileText(), []);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.theme.id).toBe('midnight-blue');
      expect(isInstallableTheme(r.theme)).toBe(true);
    }
  });

  it('refuses text that is not JSON', () => {
    const r = parseThemeFile('not json', []);
    expect(r.ok).toBe(false);
  });

  it('refuses a file of the wrong type, such as a layout', () => {
    const r = parseThemeFile(JSON.stringify({ type: 'prism-layout', version: 2, widgets: [] }), []);
    expect(r).toEqual({ ok: false, errors: [expect.stringMatching(/layout file/)] });
  });

  it('gives one message, not a list of missing tokens, for any other JSON', () => {
    expect(parseThemeFile('{"hello":1}', [])).toEqual({ ok: false, errors: ['This is not a Prism theme file.'] });
    expect(parseThemeFile('null', [])).toEqual({ ok: false, errors: ['This is not a Prism theme file.'] });
  });

  it('applies the gallery checks, so a half-theme is refused', () => {
    const light = { ...base.light } as Record<string, unknown>;
    delete light.ring;
    const r = parseThemeFile(fileText({ light }), []);
    expect(r.ok).toBe(false);
  });

  it('refuses a name that would shadow a built-in palette', () => {
    const r = parseThemeFile(fileText({ name: base.name }), []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/built-in/);
  });

  it('never replaces a theme that is already installed', () => {
    const r = parseThemeFile(fileText(), ['midnight-blue']);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/already installed/);
  });

  it('copies only known fields, so an extra key in the file goes nowhere', () => {
    const r = parseThemeFile(fileText({ onload: 'x', light: { ...base.light, extra: '1 2% 3%' } }), []);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.theme).not.toHaveProperty('onload');
      expect(r.theme.light).not.toHaveProperty('extra');
    }
  });
});
