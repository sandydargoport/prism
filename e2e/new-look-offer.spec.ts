import { test, expect } from '@playwright/test';
import { getFirstParent, getSeededParentId, verifySettingsPinViaAPI } from './helpers/auth';

/**
 * The new look for an existing household (#808): offered once on a screen,
 * Try it adds Today and the Calendar layout without touching the old one,
 * and Settings switches back.
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const PIN = process.env.E2E_PIN || '1234';

test.describe('trying the new look', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database');
  test.setTimeout(120_000);

  test('offered once, Try it adds the layouts and keeps the old one, Settings switches back', async ({ page }) => {
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
      const offer = page.getByText('Try the new look').first();
      await expect(offer).toBeVisible({ timeout: 60_000 });
      await page.reload();
      await page.waitForTimeout(4000);
      await expect(page.getByText('Try the new look'), 'only once on this screen').toHaveCount(0);

      // From Settings > Display: the same choice.
      await verifySettingsPinViaAPI(page, (await getFirstParent(page)).name);
      await page.goto('/settings?section=display');
      const card = page.locator('[data-front-page-card]');
      await card.locator('[data-new-look-try]').click();
      await expect.poll(async () => (await list()).filter((l) => l.view === 'today' || l.view === 'calendar').length, { timeout: 20_000 }).toBe(2);
      const after = await list();
      for (const l of after) if (l.view === 'today' || l.view === 'calendar') added.push(l.id);
      expect(after.find((l) => l.view === 'today')!.isDefault, 'Today is the front page').toBe(true);
      const kept = after.find((l) => l.id === oldDefault.id)!;
      expect(kept, 'the old layout stays').toBeTruthy();
      expect(kept.widgets, 'and is unchanged').toEqual(oldDefault.widgets);

      // And back.
      await page.reload();
      await card.locator('[data-new-look-back]').click();
      await expect.poll(async () => (await list()).find((l) => l.id === oldDefault.id)!.isDefault, { timeout: 20_000 }).toBe(true);
    } finally {
      await page.request.patch(`/api/layouts/${oldDefault.id}`, { data: { isDefault: true } });
      for (const id of added) await page.request.delete(`/api/layouts/${id}`);
      await page.request.patch('/api/settings', { data: { key: 'newLook', value: {} } });
    }
  });
});
