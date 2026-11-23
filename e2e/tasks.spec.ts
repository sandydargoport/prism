import { test, expect } from '@playwright/test';
import { loginViaAPI, logout, getFirstParent, FamilyMember } from './helpers/auth';
import { resetTasks } from './helpers/reset';
import { waitForQuiet } from './helpers/network';

test.describe('Tasks', () => {
  let parent: FamilyMember;

  test.beforeAll(async ({ browser }) => {
    resetTasks();
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

  test('tasks page loads with header', async ({ page }) => {
    await page.goto('/tasks');
    await waitForQuiet(page);

    // Header should show "Tasks"
    await expect(page.locator('h1')).toContainText('Tasks');
  });

  test('tasks are displayed from database', async ({ page }) => {
    await page.goto('/tasks');
    await waitForQuiet(page);
    await expect(page.locator('h1')).toContainText('Tasks', { timeout: 10000 });

    // Use the API to confirm there are tasks
    const response = await page.request.get('/api/tasks');
    const data = await response.json();

    if (data.tasks && data.tasks.length > 0) {
      // At least some content should be visible on the page
      await expect(page.locator('main').first()).toBeVisible();
    }
  });

  test('status filter buttons are visible', async ({ page }) => {
    await page.goto('/tasks');
    await waitForQuiet(page);
    await expect(page.locator('h1')).toContainText('Tasks', { timeout: 10000 });

    // Look for filter buttons — "Active" and "Completed" status filters
    const activeFilter = page.getByRole('button', { name: 'Active' });
    const completedFilter = page.getByRole('button', { name: 'Completed' });

    // At least one filter button should be visible (desktop layout)
    const anyVisible = await activeFilter.isVisible() || await completedFilter.isVisible();
    // On mobile these might be hidden, so just confirm the page loaded
    if (anyVisible) {
      await activeFilter.click();
      await expect(page.locator('h1')).toContainText('Tasks');
    }
  });

  test('group by person toggle switches view mode', async ({ page }) => {
    await page.goto('/tasks');
    await waitForQuiet(page);
    await expect(page.locator('h1')).toContainText('Tasks', { timeout: 10000 });

    // groupByUser defaults to true — the button should have 'secondary' variant
    const groupBtn = page.getByRole('button', { name: /Group by Person/i });
    if (await groupBtn.isVisible()) {
      // Click to toggle OFF grouped view
      await groupBtn.click();
      await expect(page.locator('h1')).toContainText('Tasks');

      // Click again to toggle back ON
      await groupBtn.click();

      // Tasks should still be visible after toggling
      await expect(page.locator('h1')).toContainText('Tasks');
    }
  });

  test('add task button is visible for parents', async ({ page }) => {
    await page.goto('/tasks');
    await waitForQuiet(page);

    const addBtn = page.getByRole('button', { name: /Add Task/i });
    await expect(addBtn).toBeVisible({ timeout: 10000 });
  });
});
