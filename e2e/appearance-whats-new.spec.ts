import { test, expect } from '@playwright/test';
import { getFirstParent, getSeededParentId, verifySettingsPinViaAPI } from './helpers/auth';

/**
 * Settings > Appearance after the redesign (#1017), and the one-time note of
 * what moved (#1032). The Simple/Custom choice and its offer were here until
 * the editing bar replaced them (#1151).
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const PIN = process.env.E2E_PIN || '1234';

test.describe('Appearance and what moved', () => {
  // The tests share the household's layouts and the new-look setting.
  test.describe.configure({ mode: 'serial' });
  test.skip(!HAS_TEST_DB, 'needs the seeded test database');
  test.setTimeout(120_000);

  test('Appearance is grouped, with one palette row and rare settings folded (#1017)', async ({ page }) => {
    expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
    await verifySettingsPinViaAPI(page, (await getFirstParent(page)).name);
    await page.goto('/settings?section=display');

    // Three groups, in order: the look, the background and away, all screens.
    // One screen's own settings are on its editing bar, not here (#1159).
    const groups = page.locator('[data-appearance-group]');
    await expect(groups).toHaveCount(3);
    expect(await groups.evaluateAll((els) => els.map((e) => e.getAttribute('data-appearance-group'))))
      .toEqual(['look', 'background', 'household']);

    // The palette in use is one row; the full set appears only after Change.
    const current = page.locator('[data-palette-current]');
    await expect(current).toBeVisible();
    expect((await current.boundingBox())!.height).toBeLessThanOrEqual(72);
    await expect(page.locator('[data-palette-grid]')).toHaveCount(0);
    await page.locator('[data-palette-change]').click();
    await expect(page.locator('[data-palette-grid]')).toBeVisible();

    // Language and units are folded, each showing its value while closed.
    const folds = page.locator('[data-fold]');
    await expect(folds).toHaveCount(2);
    for (const f of await folds.all()) {
      expect(await f.evaluate((d) => (d as HTMLDetailsElement).open)).toBe(false);
      await expect(f.locator('summary [data-fold-value]')).toHaveText(/\S/);
    }
    const first = folds.first();
    await first.locator('summary').click();
    expect(await first.evaluate((d) => (d as HTMLDetailsElement).open)).toBe(true);
  });

  // #1032: after the update, a one-time note of what moved and where.
  test("What's new shows once on a screen and stays in Help", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
    // ?whats-new: shown even under test automation, which otherwise keeps it away.
    await page.goto('/?whats-new');
    const note = page.locator('[data-whats-new]');
    await expect(note).toBeVisible({ timeout: 60_000 });
    expect(await note.locator('[data-whats-new-list] li').count()).toBeGreaterThanOrEqual(5);
    await expect(note.getByText('under Manage')).toBeVisible();
    await note.locator('[data-whats-new-ok]').click();
    await expect(note).toBeHidden();
    await page.reload();
    await page.waitForTimeout(2000);
    await expect(page.locator('[data-whats-new]'), 'once on this screen').toHaveCount(0);

    // And it stays findable in Help.
    await page.goto('/help');
    await page.getByText("What's new", { exact: true }).first().click();
    await expect(page.locator('[data-whats-new-list]')).toBeVisible();
  });
});
