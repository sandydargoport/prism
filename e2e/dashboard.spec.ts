import { test, expect } from '@playwright/test';
import { loginViaAPI, logout, getFirstParent, FamilyMember } from './helpers/auth';
import { resetAll } from './helpers/reset';
import { waitForQuiet } from './helpers/network';

test.describe('Dashboard', () => {
  let parent: FamilyMember;

  test.beforeAll(async ({ browser }) => {
    resetAll();
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

  test('dashboard renders widgets after login', async ({ page }) => {
    await page.goto('/');
    await waitForQuiet(page);

    // The main content area should be present
    await expect(page.locator('main').first()).toBeVisible();

    // CSS Grid dashboard renders widget cells with data-widget attribute
    const widgets = page.locator('[data-widget]');
    await expect(widgets.first()).toBeVisible({ timeout: 10000 });
    expect(await widgets.count()).toBeGreaterThan(0);
  });

  test('sidebar nav links navigate to correct pages', async ({ page }) => {
    await page.goto('/');
    await waitForQuiet(page);

    // Click Calendar nav link
    await page.click('a[href="/calendar"]');
    await expect(page).toHaveURL(/\/calendar/);

    // Click Tasks nav link
    await page.click('a[href="/tasks"]');
    await expect(page).toHaveURL(/\/tasks/);

    // Click Shopping nav link
    await page.click('a[href="/shopping"]');
    await expect(page).toHaveURL(/\/shopping/);
  });

  test('direct URL routing works for feature pages', async ({ page }) => {
    await page.goto('/chores');
    await waitForQuiet(page);

    await expect(page).toHaveURL(/\/chores/);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('dashboard home link returns to dashboard', async ({ page }) => {
    await page.goto('/tasks');
    await waitForQuiet(page);

    // Click the logo/home link
    await page.click('a[href="/"]');
    await expect(page).toHaveURL(/\/$/);
  });
});
