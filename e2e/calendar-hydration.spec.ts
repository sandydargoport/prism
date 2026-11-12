import { test, expect } from '@playwright/test';
import { getSeededParentId } from './helpers/auth';

/**
 * The calendar renders once (#479): with a view saved in this browser, the
 * server's render and the browser's first render must match, so loading the
 * page logs no hydration error.
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';

test.describe('calendar hydration', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database');
  test.setTimeout(90_000);

  for (const view of ['multiWeek', 'agenda']) {
    test(`a saved ${view} view loads with no hydration error`, async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: process.env.E2E_PIN || '1234' } })).ok()).toBe(true);
      await page.addInitScript((v) => {
        localStorage.setItem('prism-calendar-view-type', v);
        localStorage.setItem('prism-calendar-display-mode', 'cards');
      }, view);
      const errors: string[] = [];
      page.on('console', (m) => { if (/hydrat/i.test(m.text())) errors.push(m.text().slice(0, 200)); });
      page.on('pageerror', (e) => { if (/hydrat/i.test(e.message)) errors.push(e.message.slice(0, 200)); });
      await page.goto('/calendar');
      await expect(page.locator('h1').first()).toBeVisible({ timeout: 60_000 });
      await page.waitForTimeout(2000);
      expect(errors).toEqual([]);
    });
  }
});
