import { test } from '@playwright/test';
import { loginViaAPI } from '../helpers/auth';
import { resetDemoData } from '../helpers/reset';

test('Dashboard overview — logged in with layout editor', async ({ page }) => {
  resetDemoData();

  // Login via API so the video starts already authenticated
  await loginViaAPI(page, 'Alex');
  await page.goto('/');
  await page.waitForLoadState('networkidle');

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
  const btn24 = page.locator('button').filter({ hasText: '24"' });
  if (await btn24.count() > 0) {
    await btn24.first().click();
    await page.waitForTimeout(1500);
  }

  const btn27 = page.locator('button').filter({ hasText: '27"' });
  if (await btn27.count() > 0) {
    await btn27.first().click();
    await page.waitForTimeout(1500);
  }

  const btn32 = page.locator('button').filter({ hasText: '32"' });
  if (await btn32.count() > 0) {
    await btn32.first().click();
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
