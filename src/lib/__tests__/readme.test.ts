import fs from 'fs';
import path from 'path';

/**
 * The README is the repo's front page (#1121): every relative link and image
 * it points at must exist, or GitHub shows a broken image or a 404, and the
 * pitch stays short enough to read at a glance.
 */
const ROOT = path.resolve(__dirname, '../../..');
const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');

function relativeTargets(md: string): string[] {
  const found = new Set<string>();
  for (const m of md.matchAll(/\]\(([^)\s]+)\)/g)) found.add(m[1]!);
  for (const m of md.matchAll(/(?:src|srcset|href)="([^"]+)"/g)) found.add(m[1]!);
  return [...found].filter((t) => !/^(https?:|mailto:|#)/.test(t));
}

describe('README', () => {
  it('points only at files that exist', () => {
    const missing = relativeTargets(readme).filter((t) => !fs.existsSync(path.join(ROOT, t.split('#')[0]!)));
    expect(missing).toEqual([]);
  });

  it('shows the hero in light and dark', () => {
    expect(readme).toMatch(/<source media="\(prefers-color-scheme: dark\)" srcset="docs\/demos\/hero-dark\.png">/);
    expect(readme).toContain('src="docs/demos/hero-light.png"');
  });

  it('opens with a pitch of 8 words or fewer, before the install steps', () => {
    const pitch = readme.match(/<b>([^<]+)<\/b>/)![1]!;
    expect(pitch.trim().split(/\s+/).length).toBeLessThanOrEqual(8);
    expect(readme.indexOf(pitch)).toBeLessThan(readme.indexOf('## Quick start'));
  });

  it('lists the Home Assistant add-on first in Quick start', () => {
    const quick = readme.slice(readme.indexOf('## Quick start'));
    expect(quick.indexOf('Home Assistant add-on')).toBeLessThan(quick.indexOf('Docker image'));
  });
});
