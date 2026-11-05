import { test, expect, type Page } from '@playwright/test';
import { getSeededParentId } from './helpers/auth';
import { TODAY_TEMPLATE } from '../src/lib/constants/layoutTemplates';

/**
 * The dock on the wall (#922): a Menu word at rest, a labelled one-row dock on
 * a touch, gone after ten quiet seconds, and More with every other page and
 * this screen's jobs. Measured, at the wall's size and the small tablet's.
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const PIN = process.env.E2E_PIN || '1234';

test.describe('the dock on the wall', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database to log in and create a dashboard');
  test.setTimeout(90_000);

  async function openToday(page: Page) {
    const login = await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } });
    expect(login.ok(), 'precondition: login must succeed').toBe(true);
    const layout = await (await page.request.post('/api/layouts', { data: { name: `Dock e2e ${Date.now()}`, widgets: TODAY_TEMPLATE.widgets, view: 'today' } })).json();
    await page.goto(`/d/${layout.slug}`);
    await page.locator('[data-today-clock]').waitFor({ timeout: 60_000 });
    return layout as { id: string };
  }

  for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 800 }]) {
    test(`Menu at rest, a labelled one-row dock on a touch, gone after ten seconds, at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      // The clock is installed so the ten seconds can pass at once; taps are
      // raw mouse events, which need no animation frames.
      await page.clock.install();
      const layout = await openToday(page);
      try {
        await expect(page.locator('[data-dock-menu]')).toBeVisible();
        await expect(page.locator('[data-dock]')).toHaveAttribute('aria-hidden', 'true');
        await expect(page.locator('aside')).toHaveCount(0); // no rail on the wall
        const clockBefore = await page.locator('[data-today-clock]').boundingBox();

        await page.mouse.click(viewport.width / 2, viewport.height / 2);
        await expect(page.locator('[data-dock]')).not.toHaveAttribute('aria-hidden', 'true');
        const m = await page.evaluate(() => {
          const items = [...document.querySelectorAll('[data-dock] > a, [data-dock] > button')];
          return items.map((el) => {
            const r = el.getBoundingClientRect();
            return { text: (el.textContent ?? '').trim(), top: r.top, w: r.width, h: r.height, left: r.left, right: r.right };
          });
        });
        expect(m.length).toBe(8); // six pages, More, Sign in
        for (const item of m) {
          expect(item.text.length, 'every item is labelled').toBeGreaterThan(0);
          expect(item.w).toBeGreaterThanOrEqual(44);
          expect(item.h).toBeGreaterThanOrEqual(44);
          expect(item.left).toBeGreaterThanOrEqual(0);
          expect(item.right).toBeLessThanOrEqual(viewport.width);
        }
        const tops = m.map((i) => i.top);
        expect(Math.max(...tops) - Math.min(...tops), 'one row').toBeLessThanOrEqual(2);
        expect(await page.locator('[data-today-clock]').boundingBox(), 'nothing on the page moves').toEqual(clockBefore);

        await page.clock.runFor(11_000);
        await expect(page.locator('[data-dock]')).toHaveAttribute('aria-hidden', 'true');
        await expect(page.locator('[data-dock-menu]')).toBeVisible();
      } finally {
        await page.request.delete(`/api/layouts/${layout.id}`);
      }
    });
  }

  test('More has every other page, Settings, Help and this screen\'s jobs', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const layout = await openToday(page);
    try {
      await page.locator('[data-dock-menu]').click();
      const onDock = await page.locator('[data-dock] [data-dock-item]').evaluateAll((els) => els.map((e) => e.getAttribute('data-dock-item')));
      await page.locator('[data-dock-more]').click();
      const panel = page.locator('[data-dock-more-panel]');
      await expect(panel).toBeVisible();
      const inMore = await panel.locator('[data-dock-item]').evaluateAll((els) => els.map((e) => e.getAttribute('data-dock-item')));
      expect(inMore).toContain('/settings');
      expect(inMore).toContain('/help');
      expect(onDock.filter((h) => inMore.includes(h)), 'no page in both').toEqual([]);
      await expect(panel.locator('[data-screen-job="reload"]')).toBeVisible();
      await expect(panel.locator('[data-screen-job="screensaver"]')).toBeVisible();
      await expect(panel.locator('[data-screen-job="edit"]')).toBeVisible();
    } finally {
      await page.request.delete(`/api/layouts/${layout.id}`);
    }
  });
});
