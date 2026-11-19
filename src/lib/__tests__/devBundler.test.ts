/**
 * Which bundler each npm script uses.
 *
 * Dev runs on Turbopack. Under webpack, every edit-and-recompile kept about
 * 160 MB of heap that garbage collection could not free, so a dev server left
 * running through a working session grew until it was killed (measured with
 * forced GC before each reading; Turbopack stayed flat over the same edits).
 *
 * Build stays on webpack: next-pwa is a webpack plugin, and a Turbopack build
 * would stop generating the service worker the displays rely on. CI builds
 * with webpack on every pull request, so anything that only breaks there is
 * still caught.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const scripts = (JSON.parse(readFileSync(resolve(__dirname, '../../../package.json'), 'utf8')) as {
  scripts: Record<string, string>;
}).scripts;

describe('bundler per script', () => {
  it('runs the dev server on Turbopack', () => {
    expect(scripts.dev).toMatch(/^next dev\b/);
    expect(scripts.dev).toContain('--turbopack');
    expect(scripts.dev).not.toContain('--webpack');
  });

  it('builds with webpack, for the service worker', () => {
    expect(scripts.build).toMatch(/^next build\b/);
    expect(scripts.build).toContain('--webpack');
  });

  it('runs the browser tests on webpack, the bundler the build uses', () => {
    expect(scripts['dev:webpack']).toMatch(/^next dev\b.*--webpack/);
    const config = readFileSync(resolve(__dirname, '../../../playwright.config.ts'), 'utf8');
    expect(config).toMatch(/command:\s*'npm run dev:webpack'/);
  });
});
