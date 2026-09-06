/**
 * Reading a theme that spells its keys the way CSS does.
 *
 * Bare token names are this project's own convention. Everywhere else these
 * values are written with the leading `--`: in globals.css, in a devtools
 * pane, in any fork that keeps its palettes as custom-property maps. Nothing
 * tells a submitter which spelling is wanted, and the prefixed one used to
 * fail as nineteen missing tokens per mode — an error that listed, by name,
 * every value the file actually contained.
 *
 * The second half of this file pins what happens to keys the schema has no
 * place for. They are dropped, because the projection copies by name from a
 * fixed list and that is what keeps a submission from carrying anything into
 * the page. But they are reported while being dropped, so a theme that sets
 * surfaces Prism does not have gets told once rather than quietly arriving
 * flatter than it looked at home.
 */
import {
  validateCommunityTheme,
  projectCommunityTheme,
  unrecognizedTokens,
} from '../validateTheme';
import { THEME_TOKENS, normalizeTokenKeys } from '@/lib/themes/tokens';

const triple = '210 40% 50%';

/**
 * The 19 tokens, spelled however the caller wants.
 *
 * Foregrounds are dark and everything else is light, so the pairs clear 3:1
 * and these tests fail on key handling rather than on contrast.
 */
const tokenSet = (prefixed: boolean) =>
  Object.fromEntries(THEME_TOKENS.map((t) => [
    prefixed ? `--${t}` : t,
    t === 'foreground' || t.endsWith('-foreground') ? '210 40% 12%' : '210 40% 94%',
  ]));

const submission = (light: object, dark: object) => ({
  type: 'prism-theme' as const,
  version: 1 as const,
  name: 'Kitchen Calm',
  description: 'Linen and oat surfaces with sage for controls.',
  author: 'A Contributor',
  tags: ['calm'],
  light,
  dark,
});

describe('token key spelling', () => {
  it('accepts keys written as CSS custom properties', () => {
    const result = validateCommunityTheme(submission(tokenSet(true), tokenSet(true)));
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('reports a genuinely missing token, prefixed spelling or not', () => {
    const light = tokenSet(true) as Record<string, string>;
    delete light['--primary'];
    const result = validateCommunityTheme(submission(light, tokenSet(true)));
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(['"light" is missing primary.']);
  });

  it('still rejects a bad value under a prefixed key', () => {
    const light = { ...tokenSet(true), '--background': 'red; } body { display:none' };
    const result = validateCommunityTheme(submission(light, tokenSet(true)));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('background'))).toBe(true);
  });

  it('writes the bare spelling whichever way it arrived', () => {
    const projected = projectCommunityTheme(
      submission(tokenSet(true), tokenSet(true)), 'kitchen-calm',
    );
    expect(Object.keys(projected.light)).toEqual([...THEME_TOKENS]);
    expect(projected.light.background).toBe('210 40% 94%');
    expect(projected.light['muted-foreground']).toBe('210 40% 12%');
  });

  it('prefers the bare key when a file carries both spellings', () => {
    // Object order should not decide which value becomes the theme.
    const light = { ...tokenSet(true), background: '0 0% 100%' };
    const dark = { background: '0 0% 0%', ...tokenSet(true) };
    const projected = projectCommunityTheme(submission(light, dark), 'both');
    expect(projected.light.background).toBe('0 0% 100%');
    expect(projected.dark.background).toBe('0 0% 0%');
  });
});

describe('unrecognized tokens', () => {
  // The shape of a real fork's theme: the nineteen, plus surfaces this
  // project does not have — a weather ramp, calendar and widget tints.
  const extras = {
    '--weather-temp-hot': triple,
    '--calendar-surface': triple,
    '--widget-family': triple,
  };

  it('names them without failing the submission', () => {
    const result = validateCommunityTheme(
      submission({ ...tokenSet(true), ...extras }, { ...tokenSet(true), ...extras }),
    );
    expect(result.valid).toBe(true);
    expect(result.unknownTokens).toEqual([
      'calendar-surface', 'weather-temp-hot', 'widget-family',
    ]);
  });

  it('names each once, not once per mode', () => {
    const result = validateCommunityTheme(
      submission({ ...tokenSet(false), ...extras }, { ...tokenSet(false), ...extras }),
    );
    expect(result.unknownTokens).toHaveLength(3);
  });

  it('does not carry them into what gets committed', () => {
    const projected = projectCommunityTheme(
      submission({ ...tokenSet(false), ...extras }, { ...tokenSet(false), ...extras }),
      'kitchen-calm',
    );
    expect(Object.keys(projected.light)).toEqual([...THEME_TOKENS]);
    expect('weather-temp-hot' in projected.light).toBe(false);
  });

  it('is empty for a theme that sets only what the schema knows', () => {
    const result = validateCommunityTheme(submission(tokenSet(false), tokenSet(false)));
    expect(result.unknownTokens).toEqual([]);
  });

  it('survives a submission with no token sets at all', () => {
    expect(unrecognizedTokens({})).toEqual([]);
    expect(unrecognizedTokens(null)).toEqual([]);
  });
});

describe('inherited keys', () => {
  /**
   * Reading a submission must not let it supply values through anything but an
   * own property.
   *
   * `JSON.parse` gives `__proto__` back as an ordinary own key, so copying a
   * payload key by key reaches the setter and repoints the object being built.
   * Every token then resolves through a prototype the submitter wrote: absent
   * from Object.keys, so absent from the report of what was carried, and
   * copied into the committed file regardless. The triple check still applies,
   * so this was never CSS injection — it is the file a reviewer reads differing
   * from the theme that installs, which is worse in a different way.
   */
  const hostile = (payload: string) => JSON.parse(payload);

  it('ignores a __proto__ key instead of inheriting from it', () => {
    const light = hostile('{"__proto__": {"background": "1 2% 3%"}}');
    expect(normalizeTokenKeys(light).background).toBeUndefined();
    expect(Object.getPrototypeOf(normalizeTokenKeys(light))).toBeNull();
  });

  it('ignores it under the prefixed spelling too', () => {
    const light = hostile('{"--__proto__": {"background": "1 2% 3%"}}');
    expect(normalizeTokenKeys(light).background).toBeUndefined();
  });

  it('refuses constructor and prototype as token names', () => {
    const out = normalizeTokenKeys(hostile('{"constructor": "x", "prototype": "y", "background": "1 2% 3%"}'));
    expect(Object.keys(out)).toEqual(['background']);
  });

  it('does not let an inherited value reach the committed theme', () => {
    const light = hostile(`{"__proto__": ${JSON.stringify(tokenSet(false))}}`);
    const result = validateCommunityTheme(submission(light, tokenSet(false)));
    // Every token has to be its own property, so this reads as a theme that
    // supplied none of them.
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('"light" is missing background.');
  });
});
