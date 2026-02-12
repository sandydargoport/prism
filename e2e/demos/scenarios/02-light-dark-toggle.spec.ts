import { test } from '@playwright/test';
import { loginViaAPI } from '../helpers/auth';
import { resetDemoData } from '../helpers/reset';

test('Light and dark mode toggle', async ({ page }) => {
  resetDemoData();

  await loginViaAPI(page, 'Alex');
  // Navigate directly to the Display settings section
  await page.goto('/settings?section=display');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  // Click "Dark" mode button
  await page.click('button:has-text("Dark")');
  await page.waitForTimeout(2500);

  // Click "Light" mode button
  await page.click('button:has-text("Light")');
  await page.waitForTimeout(2500);
});
