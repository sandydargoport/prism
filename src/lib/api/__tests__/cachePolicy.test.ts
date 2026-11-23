import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { OWN_CACHE_POLICY } from '../cachePolicy';

function get(path: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, { method: 'GET' });
}

describe('API cache policy', () => {
  it.each([
    '/api/events?startDate=2026-10-02T07:00:00.000Z&limit=500',
    '/api/weather',
    '/api/messages?limit=10',
    '/api/settings',
  ])('tells the browser not to store %s', async (path) => {
    // The regression: these went out with no Cache-Control at all, and a
    // kiosk browser in "use cache even if expired" mode answered every poll
    // from its cache, so the display never changed after its first load.
    const res = await proxy(get(path));
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it.each([
    '/api/photos/3f2a9c10-1111-4222-8333-944455556666/file',
    '/api/recipes/3f2a9c10-1111-4222-8333-944455556666/image',
    '/api/family/3f2a9c10-1111-4222-8333-944455556666/avatar',
  ])('leaves %s to set its own caching', async (path) => {
    // Whatever the proxy sets, the route can no longer change, so setting
    // no-store here would silently undo these routes' long-lived caching.
    const res = await proxy(get(path));
    expect(res.headers.get('Cache-Control')).toBeNull();
  });

  it('does not touch page routes, which Next caches on its own terms', async () => {
    const res = await proxy(get('/calendar'));
    expect(res.headers.get('Cache-Control')).toBeNull();
  });

  it('exempts only whole paths, not anything that merely contains one', () => {
    const matches = (path: string) => OWN_CACHE_POLICY.some((p) => p.test(path));
    expect(matches('/api/photos/abc/file')).toBe(true);
    expect(matches('/api/photos')).toBe(false);
    expect(matches('/api/photos/abc/file/extra')).toBe(false);
    expect(matches('/api/photos/abc/def/file')).toBe(false);
  });
});

/**
 * Every route that sends its own Cache-Control must be exempt from the
 * proxy's default, or that header is dropped without any error. This finds
 * them by reading the route files, so a new one fails here rather than in a
 * slow wall display months later.
 */
describe('routes with their own Cache-Control', () => {
  const apiRoot = join(__dirname, '..', '..', '..', 'app', 'api');

  function routeFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      if (name === '__tests__') return [];
      if (statSync(full).isDirectory()) return routeFiles(full);
      return name === 'route.ts' ? [full] : [];
    });
  }

  /** `src/app/api/photos/[id]/file/route.ts` → `/api/photos/x/file`. */
  function samplePath(file: string): string {
    const segments = relative(apiRoot, file).split(sep).slice(0, -1);
    return '/api/' + segments.map((s) => (s.startsWith('[') ? 'x' : s)).join('/');
  }

  const ownPolicy = routeFiles(apiRoot).filter((file) => {
    const source = readFileSync(file, 'utf8');
    // no-store routes already agree with the default; nothing to protect.
    return /['"]Cache-Control['"]\s*:/i.test(source) && !/['"]Cache-Control['"]\s*:\s*['"]no-store/i.test(source);
  });

  it('finds the routes it is meant to guard', () => {
    expect(ownPolicy.length).toBeGreaterThan(0);
  });

  it.each(ownPolicy.map((file) => [samplePath(file)]))('%s is exempt', (path) => {
    expect(OWN_CACHE_POLICY.some((pattern) => pattern.test(path))).toBe(true);
  });
});
