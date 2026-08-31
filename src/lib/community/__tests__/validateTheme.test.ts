/**
 * Validating a theme that arrives from outside.
 *
 * The submission path ends in a file committed to this repository and later
 * rendered into a <style> element on every instance that installs it. So the
 * tests that matter are the ones proving what cannot get through.
 */
import { validateCommunityTheme, projectCommunityTheme } from '../validateTheme';
import { THEME_TOKENS } from '@/lib/themes/tokens';
import { BUILTIN_THEMES } from '@/lib/themes/appThemes';

const base = BUILTIN_THEMES[0]!;

function submission(over: Record<string, unknown> = {}) {
  return {
    type: 'prism-theme',
    version: 1,
    name: 'Midnight',
    description: 'Deep blues for a bedroom display.',
    author: 'Someone',
    tags: ['dark', 'calm'],
    light: { ...base.light },
    dark: { ...base.dark },
    ...over,
  };
}

describe('validateCommunityTheme — shape', () => {
  it('accepts a well-formed submission', () => {
    const r = validateCommunityTheme(submission());
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
  });

  it('requires every token, so a half-theme cannot land', () => {
    const partial = { ...base.light } as Record<string, unknown>;
    delete partial.ring;
    const r = validateCommunityTheme(submission({ light: partial }));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('ring'))).toBe(true);
  });

  it('rejects a value that could carry more than a colour', () => {
    const evil = { ...base.light, background: '0 0% 0%}</style><script>alert(1)</script>' };
    const r = validateCommunityTheme(submission({ light: evil }));
    expect(r.valid).toBe(false);
  });

  it('does not echo a rejected value back into the error message', () => {
    // Errors are rendered into a GitHub comment. Reflecting submitter text
    // there turns a validation message into a delivery mechanism.
    const evil = { ...base.light, background: '<img src=x onerror=alert(1)>' };
    const r = validateCommunityTheme(submission({ light: evil }));
    expect(r.errors.join(' ')).not.toContain('onerror');
    expect(r.errors.join(' ')).not.toContain('<img');
  });
});

describe('validateCommunityTheme — legibility', () => {
  it('rejects a theme whose text cannot be read', () => {
    const unreadable = { ...base.light, foreground: '0 0% 97%', background: '0 0% 100%' };
    const r = validateCommunityTheme(submission({ light: unreadable }));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('contrast ratio'))).toBe(true);
  });

  it('accepts a tiring theme but reports the warning', () => {
    // Hard-failing everything below AA would reject a lot of legitimately
    // attractive themes. The person installing it can see the count and judge.
    const dim = { ...base.light, 'muted-foreground': '0 0% 55%', muted: '0 0% 100%' };
    const r = validateCommunityTheme(submission({ light: dim }));
    expect(r.valid).toBe(true);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe('validateCommunityTheme — metadata', () => {
  it('rejects an overlong name', () => {
    expect(validateCommunityTheme(submission({ name: 'x'.repeat(41) })).valid).toBe(false);
  });

  it('rejects markup in a name', () => {
    expect(validateCommunityTheme(submission({ name: '<b>Hi</b>' })).valid).toBe(false);
  });

  it('rejects more than five tags', () => {
    expect(validateCommunityTheme(submission({ tags: ['a','b','c','d','e','f'] })).valid).toBe(false);
  });

  it('rejects a tag that is not a simple slug', () => {
    expect(validateCommunityTheme(submission({ tags: ['Dark Mode!'] })).valid).toBe(false);
  });

  it('rejects an overlong description', () => {
    expect(validateCommunityTheme(submission({ description: 'x'.repeat(161) })).valid).toBe(false);
  });
});

describe('projectCommunityTheme', () => {
  it('drops any key the schema does not know about', () => {
    // The point of a projection over a filter: an unknown key has no path in,
    // rather than being removed by a rule someone could forget to write.
    const smuggled = submission({
      script: '<script>alert(1)</script>',
      light: { ...base.light, 'background-image': 'url(https://example.com)' },
    });
    const out = projectCommunityTheme(smuggled, 'midnight');
    // Check the keys, not the serialised string — 'script' is a substring of
    // 'description', which made an earlier version of this test pass for the
    // wrong reason.
    expect(Object.keys(out)).not.toContain('script');
    expect(Object.keys(out.light)).not.toContain('background-image');
    expect(JSON.stringify(out)).not.toContain('alert(1)');
    expect(JSON.stringify(out)).not.toContain('example.com');
  });

  it('carries exactly the allowlisted tokens', () => {
    const out = projectCommunityTheme(submission(), 'midnight');
    expect(Object.keys(out.light).sort()).toEqual([...THEME_TOKENS].sort());
    expect(Object.keys(out.dark).sort()).toEqual([...THEME_TOKENS].sort());
  });

  it('uses the id the caller derived, not one from the payload', () => {
    // Otherwise a submission chooses its own filename.
    const out = projectCommunityTheme(submission({ id: '../../etc/passwd' }), 'midnight');
    expect(out.id).toBe('midnight');
  });

  it('caps tags even if validation was skipped', () => {
    const out = projectCommunityTheme(submission({ tags: ['a','b','c','d','e','f','g'] }), 'x');
    expect(out.tags).toHaveLength(5);
  });
});
