import { test } from '@playwright/test';
import { loginViaAPI } from '../helpers/auth';
import { resetDemoData } from '../helpers/reset';

test('Recipe browsing and ingredient check-off', async ({ page }) => {
  resetDemoData();

  await loginViaAPI(page, 'Alex');
  await page.goto('/recipes');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Click the Carne Asada recipe card (user-added recipe)
  const recipeCard = page.locator('text=Carne Asada').first();
  await recipeCard.waitFor({ state: 'visible' });
  await recipeCard.click();
  await page.waitForTimeout(1500);

  // Click maximize to expand the recipe modal
  const maximizeBtn = page.locator('button[title="Maximize"]').or(
    page.locator('button:has(svg.lucide-maximize2)')
  ).first();
  try {
    await maximizeBtn.click({ timeout: 3000 });
  } catch {
    // Modal may already be full-screen
  }
  await page.waitForTimeout(1500);

  // Scroll down within the dialog to reach the ingredients section
  const dialog = page.locator('[role="dialog"]');
  const ingredientsHeading = dialog.locator('h4:has-text("Ingredients")');
  await ingredientsHeading.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  // Click ingredients within the dialog's ul list
  const ingredientItems = dialog.locator('ul.space-y-1 > li');
  const count = await ingredientItems.count();

  // Check off the first 4 ingredients with a pause between each
  for (let i = 0; i < Math.min(4, count); i++) {
    await ingredientItems.nth(i).click({ force: true });
    await page.waitForTimeout(700);
  }

  await page.waitForTimeout(2000);
});
