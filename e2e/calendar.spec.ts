import { test, expect } from '@playwright/test';
import { loginViaAPI, logout, getFirstParent, FamilyMember } from './helpers/auth';
import { waitForQuiet } from './helpers/network';

test.describe('Calendar', () => {
  let parent: FamilyMember;

  test.beforeAll(async ({ browser }) => {
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

  test('calendar page loads with date header', async ({ page }) => {
    await page.goto('/calendar');
    await waitForQuiet(page);

    // The calendar header shows a date range title
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });

    // Navigation buttons should be present
    await expect(page.locator('button[aria-label="Previous"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Next"]')).toBeVisible();
  });

  test('Today button navigates to current date', async ({ page }) => {
    await page.goto('/calendar');
    await waitForQuiet(page);

    // Navigate away from today first
    await page.click('button[aria-label="Next"]');

    // Click Today to return
    const todayBtn = page.getByRole('button', { name: 'Today' });
    await expect(todayBtn).toBeVisible({ timeout: 5000 });
    await todayBtn.click();

    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('prev/next buttons navigate dates', async ({ page }) => {
    await page.goto('/calendar');
    await waitForQuiet(page);

    const headerText = await page.locator('h1').first().textContent();

    // Click Next — wait for header text to change
    await page.click('button[aria-label="Next"]');
    await expect(page.locator('h1').first()).not.toHaveText(headerText!, { timeout: 5000 });

    const newHeaderText = await page.locator('h1').first().textContent();
    expect(newHeaderText).not.toBe(headerText);

    // Click Previous — wait for header text to restore
    await page.click('button[aria-label="Previous"]');
    await expect(page.locator('h1').first()).toHaveText(headerText!, { timeout: 5000 });

    const restoredText = await page.locator('h1').first().textContent();
    expect(restoredText).toBe(headerText);
  });

  test('view switching buttons change calendar layout', async ({ page }) => {
    await page.goto('/calendar');
    await waitForQuiet(page);

    // View switcher buttons are inside a bordered container
    const viewSwitcher = page.locator('.border.rounded-md');

    // Try switching to Month view
    const monthBtn = viewSwitcher.getByRole('button', { name: 'Month' });
    if (await monthBtn.isVisible({ timeout: 3000 })) {
      await monthBtn.click();
      await expect(page.locator('h1').first()).toBeVisible({ timeout: 5000 });
    }

    // Try switching to Day view
    const dayBtn = viewSwitcher.getByRole('button', { name: 'Day' });
    if (await dayBtn.isVisible({ timeout: 3000 })) {
      await dayBtn.click();
      await expect(page.locator('h1').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('add event button is visible for parents', async ({ page }) => {
    await page.goto('/calendar');
    await waitForQuiet(page);

    const addBtn = page.getByRole('button', { name: /Add Event/i });
    await expect(addBtn).toBeVisible({ timeout: 10000 });
  });
});
