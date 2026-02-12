import { test } from '@playwright/test';
import { loginViaAPI } from '../helpers/auth';
import { resetDemoData } from '../helpers/reset';

test('Grocery shopping check-off with celebration', async ({ page }) => {
  resetDemoData();

  await loginViaAPI(page, 'Alex');
  await page.goto('/shopping');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  // The default active list may not be "Grocery" — click the Grocery tab
  const groceryTab = page.locator('button:has-text("Grocery")');
  await groceryTab.waitFor({ state: 'visible' });
  await groceryTab.click();
  await page.waitForTimeout(1500);

  // Check off ALL grocery items one by one (all 6 must be checked for celebration)
  const items = ['Milk', 'Bread', 'Apples', 'Chicken breast', 'Peaches', 'Yoghurt'];

  for (const itemName of items) {
    const row = page.getByText(itemName, { exact: false }).first();
    await row.waitFor({ state: 'visible', timeout: 5000 });
    await row.click();
    await page.waitForTimeout(800);
  }

  // Wait for ShoppingCelebration (cart + confetti animation ~3s)
  try {
    await page.waitForSelector('.animate-cart-ride', { timeout: 5000 });
    await page.waitForTimeout(4000);
  } catch {
    await page.waitForTimeout(2000);
  }
});
