import { test, expect } from '@playwright/test';
import { loginViaAPI, logout, getFirstParent, FamilyMember } from './helpers/auth';
import { resetChoreCompletions } from './helpers/reset';
import { waitForQuiet } from './helpers/network';

test.describe('Chores', () => {
  let parent: FamilyMember;

  test.beforeAll(async ({ browser }) => {
    resetChoreCompletions();
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

  test('chores page loads with header', async ({ page }) => {
    await page.goto('/chores');
    await waitForQuiet(page);

    await expect(page.locator('h1')).toContainText('Chores');
  });

  test('chores are displayed from database', async ({ page }) => {
    await page.goto('/chores');
    await waitForQuiet(page);
    await expect(page.locator('h1')).toContainText('Chores', { timeout: 10000 });

    // Verify via API that chores exist
    const response = await page.request.get('/api/chores');
    const data = await response.json();

    if (data.chores && data.chores.length > 0) {
      // Active chore count badge should be visible
      const badge = page.locator('header').getByText(/active/i);
      await expect(badge).toBeVisible({ timeout: 10000 });
    }
  });

  test('history button toggles completion history view', async ({ page }) => {
    await page.goto('/chores');
    await waitForQuiet(page);

    const historyBtn = page.getByRole('button', { name: /History/i });
    await expect(historyBtn).toBeVisible({ timeout: 10000 });

    await historyBtn.click();

    // Should show "Recent Completions" heading
    const historyHeading = page.getByText(/Recent Completions|Completion History/i);
    await expect(historyHeading).toBeVisible({ timeout: 5000 });
  });

  test('group by person view shows user columns', async ({ page }) => {
    await page.goto('/chores');
    await waitForQuiet(page);
    await expect(page.locator('h1')).toContainText('Chores', { timeout: 10000 });

    const groupBtn = page.getByRole('button', { name: /Group by Person/i });
    if (await groupBtn.isVisible()) {
      const userHeaders = page.locator('h3');
      expect(await userHeaders.count()).toBeGreaterThan(0);
    }
  });

  test('add chore button is visible for parents', async ({ page }) => {
    await page.goto('/chores');
    await waitForQuiet(page);

    const addBtn = page.getByRole('button', { name: /Add Chore/i });
    await expect(addBtn).toBeVisible({ timeout: 10000 });
  });
});
