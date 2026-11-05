import { test, expect } from '@playwright/test';
import { getSeededParentId } from './helpers/auth';

/**
 * The Chores page (#880) opens on what to do: list rows (#932) at least 56px
 * tall, no on or off switch outside Manage, and a tick with Undo.
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const PIN = process.env.E2E_PIN || '1234';

test.describe('the Chores page', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database');
  test.setTimeout(90_000);

  test('a do list first, switches behind Manage, and a tick that can be undone', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
    const settings = (await (await page.request.get('/api/settings')).json()).settings ?? {};
    const original = settings.security ?? {};
    const completions = async (choreId: string) => {
      const res = await (await page.request.get('/api/chores/completions?days=2&limit=100')).json();
      return ((res.completions ?? res) as Array<{ choreId: string }>).filter((c) => c.choreId === choreId).length;
    };
    try {
      await page.request.patch('/api/settings', { data: { key: 'security', value: { ...original, requirePinForEveryChange: false } } });
      await page.goto('/chores');
      const rows = page.locator('[data-chores-do] [data-list-row]');
      await expect(rows.first()).toBeVisible({ timeout: 60_000 });
      const heights = await rows.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
      for (const h of heights) expect(h, 'row height').toBeGreaterThanOrEqual(56);
      await expect(page.getByRole('switch'), 'no on or off switch outside Manage').toHaveCount(0);

      // Tick the first one; Undo takes it back.
      const title = (await rows.first().locator('.truncate').first().textContent())!.trim();
      const chores = await (await page.request.get('/api/chores')).json();
      const chore = (chores.chores ?? chores).find((c: { title: string }) => c.title === title);
      const before = await completions(chore.id);
      await rows.first().locator('button').first().click();
      const who = page.locator('[data-who-did-it]');
      if (await who.isVisible({ timeout: 1500 }).catch(() => false)) await who.locator('button').first().click();
      const undo = page.getByRole('button', { name: 'Undo' });
      await expect(undo).toBeVisible();
      await expect.poll(() => completions(chore.id)).toBe(before + 1);
      await undo.click();
      await expect.poll(() => completions(chore.id), { timeout: 15_000 }).toBe(before);

      // Manage shows the switches.
      await page.locator('[data-chores-manage]').click();
      await expect(page.getByRole('switch').first()).toBeVisible();
    } finally {
      await page.request.patch('/api/settings', { data: { key: 'security', value: original } });
    }
  });
});
