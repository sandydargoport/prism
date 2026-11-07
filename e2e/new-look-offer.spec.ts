import { test, expect } from '@playwright/test';
import { getFirstParent, getSeededParentId, verifySettingsPinViaAPI } from './helpers/auth';

/**
 * The Simple layout for an existing household (#808, #991): offered once on a
 * screen; Settings > Display picks Simple or Custom, which adds Today and the
 * Calendar layout without touching the old one, and switches back. No text
 * says "new look".
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const PIN = process.env.E2E_PIN || '1234';

test.describe('Simple or Custom', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database');
  test.setTimeout(120_000);

  test('Appearance is grouped, with one palette row and rare settings folded (#1017)', async ({ page }) => {
    expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
    await verifySettingsPinViaAPI(page, (await getFirstParent(page)).name);
    await page.goto('/settings?section=display');

    // Three groups, in order: the look, the background and idle, this screen.
    const groups = page.locator('[data-appearance-group]');
    await expect(groups).toHaveCount(3);
    expect(await groups.evaluateAll((els) => els.map((e) => e.getAttribute('data-appearance-group'))))
      .toEqual(['look', 'background', 'screen']);

    // The palette in use is one row; the full set appears only after Change.
    const current = page.locator('[data-palette-current]');
    await expect(current).toBeVisible();
    expect((await current.boundingBox())!.height).toBeLessThanOrEqual(72);
    await expect(page.locator('[data-palette-grid]')).toHaveCount(0);
    await page.locator('[data-palette-change]').click();
    await expect(page.locator('[data-palette-grid]')).toBeVisible();

    // Language, units and performance are folded, each showing its value while closed.
    const folds = page.locator('[data-fold]');
    await expect(folds).toHaveCount(3);
    for (const f of await folds.all()) {
      expect(await f.evaluate((d) => (d as HTMLDetailsElement).open)).toBe(false);
      await expect(f.locator('summary [data-fold-value]')).toHaveText(/\S/);
    }
    const first = folds.first();
    await first.locator('summary').click();
    expect(await first.evaluate((d) => (d as HTMLDetailsElement).open)).toBe(true);
  });

  test('offered once; Simple adds the layouts and keeps the old one; Custom switches back', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
    type L = { id: string; name: string; isDefault: boolean; view?: string; widgets: unknown };
    const list = async () => ((await (await page.request.get('/api/layouts')).json()).layouts ?? []) as L[];
    // Premise: an existing household with no Today yet.
    for (const l of await list()) if (l.view === 'today' || l.view === 'calendar') await page.request.delete(`/api/layouts/${l.id}`);
    const before = await list();
    const oldDefault = before.find((l) => l.isDefault)!;
    expect(oldDefault, 'premise: a default layout').toBeTruthy();
    const added: string[] = [];
    try {
      await page.goto('/');
      const offer = page.getByText("There's a Simple layout for this screen").first();
      await expect(offer).toBeVisible({ timeout: 60_000 });
      await page.reload();
      await page.waitForTimeout(4000);
      await expect(page.getByText("There's a Simple layout for this screen"), 'only once on this screen').toHaveCount(0);

      // From Settings > Display: the same choice.
      await verifySettingsPinViaAPI(page, (await getFirstParent(page)).name);
      await page.goto('/settings?section=display');
      const card = page.locator('[data-front-page-card]');
      await expect(card.locator('[data-front-page-choice="custom"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByText(/new look/i), 'no "new look" text').toHaveCount(0);
      // A compact choice, no taller than a settings card (#991): it pushed the
      // rest of Appearance off the first screen when it drew big pictures.
      const h = await card.evaluate((e) => e.getBoundingClientRect().height);
      expect(h, 'Front page card height').toBeLessThanOrEqual(240);
      await card.locator('[data-front-page-choice="simple"]').click();
      await expect.poll(async () => (await list()).filter((l) => l.view === 'today' || l.view === 'calendar').length, { timeout: 20_000 }).toBe(2);
      const after = await list();
      for (const l of after) if (l.view === 'today' || l.view === 'calendar') added.push(l.id);
      expect(after.find((l) => l.view === 'today')!.isDefault, 'Today is the front page').toBe(true);
      const kept = after.find((l) => l.id === oldDefault.id)!;
      expect(kept, 'the old layout stays').toBeTruthy();
      expect(kept.widgets, 'and is unchanged').toEqual(oldDefault.widgets);

      await expect(card.locator('[data-front-page-choice="simple"]')).toHaveAttribute('aria-pressed', 'true');

      // And back to Custom: the old layout is the front page again.
      await card.locator('[data-front-page-choice="custom"]').click();
      await expect.poll(async () => (await list()).find((l) => l.id === oldDefault.id)!.isDefault, { timeout: 20_000 }).toBe(true);
      await expect(card.locator('[data-front-page-choice="custom"]')).toHaveAttribute('aria-pressed', 'true');
    } finally {
      await page.request.patch(`/api/layouts/${oldDefault.id}`, { data: { isDefault: true } });
      for (const id of added) await page.request.delete(`/api/layouts/${id}`);
      await page.request.patch('/api/settings', { data: { key: 'newLook', value: {} } });
    }
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
