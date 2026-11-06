import { test, expect, type Page } from '@playwright/test';
import { getSeededParentId } from './helpers/auth';
import { TODAY_TEMPLATE } from '../src/lib/constants/layoutTemplates';

/**
 * Touch targets on the wall (#837): on a touch screen at 1080p, every button
 * and link on the dashboard, grid or Today, is at least 44px each way.
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';

async function undersized(page: Page) {
  return page.evaluate(() => [...document.querySelectorAll('button, a[href], [role="button"]')]
    .map((e) => {
      const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      const shown = cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0 && cs.pointerEvents !== 'none';
      return { r, shown, what: `${e.tagName} "${(e.getAttribute('aria-label') || (e as HTMLElement).innerText || '').trim().slice(0, 30)}"` };
    })
    .filter((x) => x.shown && x.r.width > 0 && x.r.height > 0 && x.r.bottom > 0 && x.r.top < innerHeight)
    .filter((x) => x.r.width < 44 || x.r.height < 44)
    .map((x) => `${Math.round(x.r.width)}x${Math.round(x.r.height)} ${x.what}`));
}

test('every control on the wall is a 44px target on a touch screen', async ({ playwright }, info) => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database');
  test.setTimeout(120_000);
  const browser = await playwright.chromium.launch({ args: ['--blink-settings=primaryPointerType=2,availablePointerTypes=2'] });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, hasTouch: true, baseURL: info.project.use.baseURL });
  const page = await context.newPage();
  expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: process.env.E2E_PIN || '1234' } })).ok()).toBe(true);
  const layout = await (await page.request.post('/api/layouts', { data: { name: `Targets ${Date.now()}`, widgets: TODAY_TEMPLATE.widgets, view: 'today' } })).json();
  try {
    for (const url of ['/', `/d/${layout.slug}`]) {
      await page.goto(url);
      await expect(page.locator('.widget-cell, [data-today-scene]').first()).toBeVisible({ timeout: 60_000 });
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.mouse.click(960, 540); // wake the dock, so its buttons are measured too
      await page.waitForTimeout(600);
      expect(await undersized(page), `on ${url}`).toEqual([]);
    }
  } finally {
    await page.request.delete(`/api/layouts/${layout.id}`);
    await browser.close();
  }
});
