import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('homepage loads', async ({ page }) => {
    await page.goto('/');
    // Wait for the page to be interactive
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('navigation sidebar is visible', async ({ page }) => {
    await page.goto('/');
    // The sidebar/nav should be present
    const sidebar = page.locator('nav');
    await expect(sidebar).toBeVisible();
  });

  test('calendar page loads', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page).toHaveURL(/calendar/);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('tasks page loads', async ({ page }) => {
    await page.goto('/tasks');
    await expect(page).toHaveURL(/tasks/);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('chores page loads', async ({ page }) => {
    await page.goto('/chores');
    await expect(page).toHaveURL(/chores/);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('shopping page loads', async ({ page }) => {
    await page.goto('/shopping');
    await expect(page).toHaveURL(/shopping/);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('meals page loads', async ({ page }) => {
    await page.goto('/meals');
    await expect(page).toHaveURL(/meals/);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('settings page loads', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/settings/);
    await expect(page.locator('main').first()).toBeVisible();
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
