import { test, expect, type Page } from '@playwright/test';
import { getFirstParent, verifySettingsPinViaAPI } from './helpers/auth';

/**
 * Help and Settings scroll on a short window (#843). The page body does not
 * scroll (the wall fills its screen), so each page must scroll inside itself:
 * the last Help topic and the last Settings section can be reached with the
 * mouse wheel at 1197x606.
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';

/** Wheel over a point until the element is fully in view, or give up. */
async function wheelTo(page: Page, over: { x: number; y: number }, target: ReturnType<Page['locator']>) {
  await page.mouse.move(over.x, over.y);
  for (let i = 0; i < 30; i++) {
    const box = await target.boundingBox();
    if (box && box.y >= 0 && box.y + box.height <= 606) return true;
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(80);
  }
  return false;
}

test.describe('pages scroll on a short window', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database');
  test.setTimeout(90_000);

  test('the last Help topic can be scrolled into view', async ({ page }) => {
    await page.setViewportSize({ width: 1197, height: 606 });
    await page.goto('/help');
    const last = page.getByRole('button', { name: /Troubleshooting/ }).last();
    await expect(last).toBeAttached({ timeout: 60_000 });
    expect(await wheelTo(page, { x: 600, y: 300 }, last), 'reached by scrolling').toBe(true);
  });

  test('the last Settings section in the side list can be scrolled into view', async ({ page }) => {
    await page.setViewportSize({ width: 1197, height: 606 });
    const parent = await getFirstParent(page);
    await verifySettingsPinViaAPI(page, parent.name);
    await page.goto('/settings');
    const nav = page.locator('nav').filter({ has: page.getByRole('button') }).first();
    await expect(nav).toBeVisible({ timeout: 60_000 });
    const last = nav.getByRole('button').last();
    const navBox = (await nav.boundingBox())!;
    expect(await wheelTo(page, { x: navBox.x + navBox.width / 2, y: navBox.y + 100 }, last), 'reached by scrolling').toBe(true);
  });
});
