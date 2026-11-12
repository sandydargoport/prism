import { test, expect } from '@playwright/test';
import { waitForQuiet } from './helpers/network';
import { getSeededParentId } from './helpers/auth';

/**
 * #1081 (part of #1043): a page change asks for settings, calendars and
 * layouts about once, not once per hook. On a slow wall tablet every extra
 * response is a parse and a re-render. Counted on client-side page changes
 * from the dock, as a person moves around the wall.
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const PIN = process.env.E2E_PIN || '1234';

test.describe('requests per page change', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database');
  test.setTimeout(120_000);

  test('settings, calendars and layouts are each asked for about once', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
    let log: string[] = [];
    page.on('request', (r) => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/')) log.push(u.pathname); });
    await page.goto('/');
    await waitForQuiet(page);
    for (const path of ['/calendar', '/', '/shopping']) {
      log = [];
      const link = page.getByRole('navigation', { name: 'Pages' }).locator(`a[href="${path}"]`).first();
      if (!(await link.isVisible().catch(() => false))) await page.locator('[data-dock-menu]').click();
      await link.click();
      await page.waitForURL((u) => u.pathname === path);
      await waitForQuiet(page);
      await page.waitForTimeout(1500);
      const count = (p: string) => log.filter((l) => l === p).length;
      // At most two: a read after an earlier one has finished is asked again
      // on purpose, so a write is always seen.
      expect(count('/api/settings'), `${path}: settings`).toBeLessThanOrEqual(2);
      expect(count('/api/calendars'), `${path}: calendars`).toBeLessThanOrEqual(1);
      expect(count('/api/layouts'), `${path}: layouts`).toBeLessThanOrEqual(1);
    }
  });
});
