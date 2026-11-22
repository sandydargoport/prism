import { test, expect } from '@playwright/test';
import { loginViaAPI, logout, getFirstParent, FamilyMember } from './helpers/auth';
import { waitForQuiet } from './helpers/network';

test.describe('Goals', () => {
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

  test('goals page loads with header', async ({ page }) => {
    await page.goto('/goals');
    await waitForQuiet(page);

    // Page header should be visible
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });
  });

  test('goals list renders when data exists', async ({ page }) => {
    await page.goto('/goals');
    await waitForQuiet(page);

    // Wait for loading to finish — either goals appear or an empty state
    await page.waitForTimeout(2000);

    // The goals API should return successfully
    const apiRes = await page.request.get('/api/goals');
    expect(apiRes.ok()).toBeTruthy();
    const data = await apiRes.json();

    if (data.goals && data.goals.length > 0) {
      // At least one goal name should be visible on the page
      const firstGoalName = data.goals[0].name;
      await expect(page.getByText(firstGoalName)).toBeVisible({ timeout: 10000 });
    }
  });

  test('point counters display for children', async ({ page }) => {
    await page.goto('/goals');
    await waitForQuiet(page);

    // Fetch goals data to check if children exist
    const apiRes = await page.request.get('/api/goals');
    const data = await apiRes.json();

    if (data.children && data.children.length > 0) {
      // Child names should appear as point counter labels
      for (const child of data.children) {
        await expect(page.getByText(child.name).first()).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('add goal button visible for parent', async ({ page }) => {
    await page.goto('/goals');
    await waitForQuiet(page);

    const addBtn = page.getByRole('button', { name: /Add Goal/i });
    await expect(addBtn).toBeVisible({ timeout: 10000 });
  });

  test('add goal modal opens and closes', async ({ page }) => {
    await page.goto('/goals');
    await waitForQuiet(page);

    const addBtn = page.getByRole('button', { name: /Add Goal/i });
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();

    // Dialog should open with a title like "Add Goal" or "New Goal"
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Close the dialog (press Escape or click the close area)
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });

  test('goals API returns expected shape', async ({ page }) => {
    const apiRes = await page.request.get('/api/goals');
    expect(apiRes.ok()).toBeTruthy();

    const data = await apiRes.json();
    expect(data).toHaveProperty('goals');
    expect(data).toHaveProperty('progress');
    expect(data).toHaveProperty('children');
    expect(Array.isArray(data.goals)).toBe(true);
    expect(Array.isArray(data.children)).toBe(true);
  });

  test('create and delete a goal via API', async ({ page }) => {
    const testName = `E2E Goal ${Date.now()}`;

    // Create
    const createRes = await page.request.post('/api/goals', {
      data: {
        name: testName,
        pointCost: 10,
        emoji: '🎯',
        recurring: false,
      },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    expect(created.goal).toBeTruthy();
    expect(created.goal.name).toBe(testName);
    expect(created.goal.pointCost).toBe(10);

    // Delete
    const deleteRes = await page.request.delete(`/api/goals/${created.goal.id}`);
    expect(deleteRes.ok()).toBeTruthy();
  });
});
