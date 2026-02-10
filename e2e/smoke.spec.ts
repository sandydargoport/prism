import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('homepage loads and shows dashboard or login', async ({ page }) => {
    await page.goto('/');

    // Should either show the dashboard or the PIN login screen
    const hasLoginPrompt = await page.locator('text=Enter PIN').isVisible().catch(() => false);
    const hasDashboard = await page.locator('[data-testid="dashboard"]').isVisible().catch(() => false);
    const hasWelcome = await page.locator('text=Welcome').isVisible().catch(() => false);

    expect(hasLoginPrompt || hasDashboard || hasWelcome).toBe(true);
  });

  test('navigation sidebar is visible', async ({ page }) => {
    await page.goto('/');

    // The sidebar should be present (might be collapsed on mobile)
    const sidebar = page.locator('nav');
    await expect(sidebar).toBeVisible();
  });

  test('calendar page loads', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page).toHaveURL(/calendar/);

    // Should show calendar view or week/day toggle
    const hasCalendarContent = await page.locator('text=Week').isVisible().catch(() => false)
      || await page.locator('text=Day').isVisible().catch(() => false)
      || await page.locator('text=Month').isVisible().catch(() => false);

    expect(hasCalendarContent).toBe(true);
  });

  test('tasks page loads', async ({ page }) => {
    await page.goto('/tasks');
    await expect(page).toHaveURL(/tasks/);

    // Should have tasks heading or add task button
    const hasTasksContent = await page.locator('text=Tasks').first().isVisible().catch(() => false)
      || await page.locator('text=Add Task').isVisible().catch(() => false);

    expect(hasTasksContent).toBe(true);
  });

  test('chores page loads', async ({ page }) => {
    await page.goto('/chores');
    await expect(page).toHaveURL(/chores/);

    // Should have chores heading
    const hasChoresContent = await page.locator('text=Chores').first().isVisible().catch(() => false);
    expect(hasChoresContent).toBe(true);
  });

  test('shopping page loads', async ({ page }) => {
    await page.goto('/shopping');
    await expect(page).toHaveURL(/shopping/);

    // Should have shopping content
    const hasShoppingContent = await page.locator('text=Shopping').first().isVisible().catch(() => false)
      || await page.locator('text=Grocery').isVisible().catch(() => false);

    expect(hasShoppingContent).toBe(true);
  });

  test('meals page loads', async ({ page }) => {
    await page.goto('/meals');
    await expect(page).toHaveURL(/meals/);

    // Should show meal planning content with day names
    const hasMealsContent = await page.locator('text=Monday').isVisible().catch(() => false)
      || await page.locator('text=Meals').first().isVisible().catch(() => false);

    expect(hasMealsContent).toBe(true);
  });

  test('settings page loads', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/settings/);

    // Should have settings heading
    const hasSettingsContent = await page.locator('text=Settings').first().isVisible().catch(() => false);
    expect(hasSettingsContent).toBe(true);
  });
});

test.describe('API Health', () => {
  test('health endpoint returns ok', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data.status).toBe('ok');
  });

  test('family endpoint returns data', async ({ request }) => {
    const response = await request.get('/api/family');
    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data).toHaveProperty('members');
    expect(Array.isArray(data.members)).toBe(true);
  });

  test('tasks endpoint returns data', async ({ request }) => {
    const response = await request.get('/api/tasks');
    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data).toHaveProperty('tasks');
    expect(Array.isArray(data.tasks)).toBe(true);
  });

  test('chores endpoint returns data', async ({ request }) => {
    const response = await request.get('/api/chores');
    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data).toHaveProperty('chores');
    expect(Array.isArray(data.chores)).toBe(true);
  });
});
