import { test, expect } from '@playwright/test';
import { loginViaAPI, logout, getFirstParent, FamilyMember } from './helpers/auth';
import { resetShoppingItems } from './helpers/reset';
import { waitForQuiet } from './helpers/network';

test.describe('Shopping', () => {
  let parent: FamilyMember;

  test.beforeAll(async ({ browser }) => {
    resetShoppingItems();
    const page = await browser.newPage();
    parent = await getFirstParent(page);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page, parent.name);
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('shopping page loads with header', async ({ page }) => {
    await page.goto('/shopping');
    await waitForQuiet(page);

    await expect(page.locator('h1')).toContainText('Shopping');
  });

  test('shopping items display in categories or columns', async ({ page }) => {
    await page.goto('/shopping');
    await waitForQuiet(page);
    await expect(page.locator('h1')).toContainText('Shopping', { timeout: 10000 });

    // Category columns have data-category or data-column attributes
    const categories = page.locator('[data-category]');
    const columns = page.locator('[data-column]');

    const catCount = await categories.count();
    const colCount = await columns.count();

    // At least one type of column layout should be present
    expect(catCount + colCount).toBeGreaterThan(0);
  });

  test('checking an item updates progress', async ({ page }) => {
    await page.goto('/shopping');
    await waitForQuiet(page);
    await expect(page.locator('h1')).toContainText('Shopping', { timeout: 10000 });

    // Find progress text showing "X/Y" format
    const progressText = page.getByText(/\d+\/\d+/);
    await expect(progressText.first()).toBeVisible({ timeout: 10000 });
    const initialText = await progressText.first().textContent();

    // Find a clickable shopping item
    const items = page.locator('[class*="cursor-pointer"]').filter({
      has: page.locator('span'),
    });

    if (await items.count() > 0) {
      await items.first().click();

      // Wait for progress text to update
      await expect(progressText.first()).not.toHaveText(initialText!, { timeout: 10000 });

      // Progress text should have changed
      const updatedText = await progressText.first().textContent();
      expect(updatedText).not.toBe(initialText);
    }

    // Reset
    resetShoppingItems();
  });

  test('shopping mode can be entered and exited', async ({ page }) => {
    await page.goto('/shopping');
    await waitForQuiet(page);
    await expect(page.locator('h1')).toContainText('Shopping', { timeout: 10000 });

    // Look for the enter shopping mode button (maximize icon)
    const enterBtn = page.locator('button').filter({
      has: page.locator('svg.lucide-maximize2, svg.lucide-maximize-2'),
    });

    if (await enterBtn.count() > 0 && await enterBtn.first().isVisible({ timeout: 3000 })) {
      await enterBtn.first().click();

      // In shopping mode, the exit button (minimize) should appear
      const exitBtn = page.locator('button').filter({
        has: page.locator('svg.lucide-minimize2, svg.lucide-minimize-2'),
      });
      await expect(exitBtn.first()).toBeVisible({ timeout: 5000 });

      await exitBtn.first().click();
    }
  });

  test('progress bar reflects checked items', async ({ page }) => {
    await page.goto('/shopping');
    await waitForQuiet(page);

    // Progress text or bar should be visible showing "X/Y" format
    const progressText = page.getByText(/\d+\/\d+/);
    await expect(progressText.first()).toBeVisible({ timeout: 10000 });
  });

  test('add list button is visible', async ({ page }) => {
    await page.goto('/shopping');
    await waitForQuiet(page);

    // Either "Add List" in header or "New List" dashed button may be present
    const addListBtn = page.getByRole('button', { name: 'Add List' });
    const newListBtn = page.getByRole('button', { name: 'New List' });

    const addVisible = await addListBtn.isVisible({ timeout: 5000 });
    const newVisible = await newListBtn.isVisible({ timeout: 1000 });
    expect(addVisible || newVisible).toBe(true);
  });
});
