import { test } from '@playwright/test';
import { loginViaAPI } from '../helpers/auth';
import { resetDemoData } from '../helpers/reset';
import { waitForQuiet } from '../../helpers/network';

test('Dashboard overview — logged in with layout editor', async ({ page }) => {
  resetDemoData();

  // Login via API so the video starts already authenticated
  await loginViaAPI(page, 'Alex');
  await page.goto('/');
  await waitForQuiet(page);

  // Pause on dashboard to show widgets in logged-in state
  await page.waitForTimeout(3000);

  // Hover SideNav to expand it
  await page.hover('aside');
  await page.waitForTimeout(2000);

  // Move mouse away to collapse nav
  await page.mouse.move(640, 360);
  await page.waitForTimeout(1000);

  // Click the edit layout button
  await page.click('button[aria-label="Edit layout"]');
  await page.waitForTimeout(2000);

  // Toggle screen safe zone sizes to show the dashed lines
  const btn1080 = page.locator('button').filter({ hasText: '16:9 (1080p)' });
  if (await btn1080.count() > 0) {
    await btn1080.first().click();
    await page.waitForTimeout(1500);
  }

  const btnSurface = page.locator('button').filter({ hasText: '3:2 (Surface)' });
  if (await btnSurface.count() > 0) {
    await btnSurface.first().click();
    await page.waitForTimeout(1500);
  }

  const btniPad = page.locator('button').filter({ hasText: '4:3 (iPad)' });
  if (await btniPad.count() > 0) {
    await btniPad.first().click();
    await page.waitForTimeout(1500);
  }

  // Toggle orientation to Portrait
  const orientationBtn = page.locator('button').filter({ hasText: /Landscape|Portrait/ });
  if (await orientationBtn.count() > 0) {
    await orientationBtn.first().click();
    await page.waitForTimeout(2000);
  }

  // Toggle back to Landscape
  const landscapeBtn = page.locator('button').filter({ hasText: /Landscape|Portrait/ });
  if (await landscapeBtn.count() > 0) {
    await landscapeBtn.first().click();
    await page.waitForTimeout(1500);
  }

  // Close the editor by pressing Escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
});
