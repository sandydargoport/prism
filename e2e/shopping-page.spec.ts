import { test, expect } from '@playwright/test';
import { getSeededParentId } from './helpers/auth';

/**
 * The Shopping page (#881): one calm list, controls on the item you tap, and
 * what is checked folds into "In the cart".
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const PIN = process.env.E2E_PIN || '1234';

test.describe('the Shopping page', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database');
  test.setTimeout(90_000);

  test('a calm list: no controls until tapped, a check moves an item into the cart and back', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
    const lists = await (await page.request.get('/api/shopping-lists')).json();
    const list = (lists.lists ?? lists)[0];
    const name = `Calm item ${Date.now()}`;
    const item = await (await page.request.post('/api/shopping-items', { data: { listId: list.id, name, category: 'produce' } })).json();
    try {
      await page.goto('/shopping');
      const calm = page.locator('[data-shopping-calm]');
      await expect(calm).toBeVisible({ timeout: 60_000 });
      await expect(calm.locator('[data-list-row-actions]'), 'no edit or delete at rest').toHaveCount(0);
      const heights = await calm.locator('[data-list-row]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
      for (const h of heights) expect(h).toBeGreaterThanOrEqual(56);

      const row = calm.locator('[data-list-row]').filter({ hasText: name });
      await row.locator('> button:not([data-shopping-ring])').click();
      await expect(row.locator('[data-list-row-actions]')).toBeVisible();
      await expect(calm.locator('[data-list-row-actions]'), 'only on the tapped item').toHaveCount(1);

      await row.locator('[data-shopping-ring]').click();
      await expect(calm.locator('[data-shopping-cart-toggle]')).toBeVisible();
      await calm.locator('[data-shopping-cart-toggle]').click();
      const inCart = calm.locator('[data-shopping-cart] [data-list-row]').filter({ hasText: name });
      await expect(inCart).toBeVisible();
      await inCart.locator('[data-shopping-ring]').click();
      await expect(calm.locator('[data-shopping-category] [data-list-row]').filter({ hasText: name })).toBeVisible();
    } finally {
      await page.request.delete(`/api/shopping-items/${item.id}`);
    }
  });
});
