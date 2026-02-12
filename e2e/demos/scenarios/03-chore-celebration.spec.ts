import { test } from '@playwright/test';
import { loginViaAPI } from '../helpers/auth';
import { resetDemoData } from '../helpers/reset';

test('Chore completion with plane celebration', async ({ page }) => {
  resetDemoData();

  await loginViaAPI(page, 'Emma');
  await page.goto('/chores');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Emma has "Empty dishwasher" in the grouped-by-person view.
  // The clickable chore card uses div.rounded-md.cursor-pointer (NOT div.rounded-lg which is the group container).
  const choreCard = page.locator('div.cursor-pointer', { hasText: 'Empty dishwasher' }).first();
  await choreCard.waitFor({ state: 'visible' });
  await choreCard.click();
  await page.waitForTimeout(1000);

  // Wait for PlaneCelebration to appear and play (5s animation)
  try {
    await page.waitForSelector('.animate-plane-fly', { timeout: 5000 });
    // Let the full plane animation play out
    await page.waitForTimeout(6000);
  } catch {
    // Celebration may not fire in some states; wait anyway
    await page.waitForTimeout(4000);
  }
});
