import { test, expect } from '@playwright/test';
import { getSeededParentId } from './helpers/auth';

/**
 * The Shopping page (#881): one calm list, controls on the item you tap, and
 * what is checked folds into "Checked off". Headings in the display face with
 * a muted colour mark (#986).
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

      // Headings (#986): the display face, not capitals, a muted colour mark.
      const heading = calm.locator('[data-shopping-category="produce"] h2');
      const look = await heading.evaluate((h) => {
        const probe = document.createElement('span');
        probe.style.fontFamily = 'var(--font-display)';
        document.body.appendChild(probe);
        const display = getComputedStyle(probe).fontFamily;
        probe.remove();
        const cs = getComputedStyle(h);
        const [r, g, b] = getComputedStyle(h.querySelector('[data-shopping-category-mark]')!).backgroundColor.match(/\d+/g)!.map(Number).map((v) => v / 255);
        const max = Math.max(r!, g!, b!), min = Math.min(r!, g!, b!), l = (max + min) / 2;
        const sat = max === min ? 0 : (max - min) / (l > 0.5 ? 2 - max - min : max + min);
        return { font: cs.fontFamily, display, transform: cs.textTransform, sat };
      });
      expect(look.font, 'heading in the display face').toBe(look.display);
      expect(look.transform, 'no capitals').toBe('none');
      expect(look.sat, 'a muted mark').toBeLessThanOrEqual(0.4);

      const row = calm.locator('[data-list-row]').filter({ hasText: name });
      await row.locator('> button:not([data-shopping-ring])').click();
      await expect(row.locator('[data-list-row-actions]')).toBeVisible();
      await expect(calm.locator('[data-list-row-actions]'), 'only on the tapped item').toHaveCount(1);

      await row.locator('[data-shopping-ring]').click();
      await expect(calm.locator('[data-shopping-cart-toggle]')).toBeVisible();
      await expect(calm.locator('[data-shopping-cart-toggle]')).toHaveText(/^Checked off \(\d+\)$/);
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
