import { test, expect } from '@playwright/test';
import { loginViaAPI, logout, getFirstParent, getFamilyMembers, FamilyMember } from './helpers/auth';
import { waitForQuiet } from './helpers/network';

test.describe('Settings', () => {
  let parent: FamilyMember;
  let allMembers: FamilyMember[];

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    parent = await getFirstParent(page);
    allMembers = await getFamilyMembers(page);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page, parent.name);
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('settings page loads with section navigation', async ({ page }) => {
    await page.goto('/settings');
    await waitForQuiet(page);

    await expect(page.locator('h1')).toContainText('Settings');

    // Section buttons should be visible
    const familyBtn = page.getByRole('button', { name: /Family Members/i });
    await expect(familyBtn).toBeVisible({ timeout: 10000 });
  });

  test('clicking section buttons navigates between settings sections', async ({ page }) => {
    await page.goto('/settings');
    await waitForQuiet(page);

    // Click "Display" section
    const displayBtn = page.getByRole('button', { name: /Display/i });
    await expect(displayBtn).toBeVisible({ timeout: 10000 });
    await displayBtn.click();

    // Display section should show theme-related content
    const themeText = page.getByText(/Theme|Dark|Light/i);
    await expect(themeText.first()).toBeVisible({ timeout: 5000 });
  });

  test('family members section shows member list', async ({ page }) => {
    await page.goto('/settings');
    await waitForQuiet(page);

    const familyBtn = page.getByRole('button', { name: /Family Members/i });
    await familyBtn.click();

    // Should show actual family member names in the settings content area
    // Use .font-medium to target the member name display, not nav elements
    for (const member of allMembers.slice(0, 2)) {
      await expect(page.locator('.font-medium', { hasText: member.name }).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('about section shows app version', async ({ page }) => {
    await page.goto('/settings');
    await waitForQuiet(page);

    const aboutBtn = page.getByRole('button', { name: /About/i });
    await expect(aboutBtn).toBeVisible({ timeout: 10000 });
    await aboutBtn.click();

    // About section should show version number
    const versionText = page.getByText(/\d+\.\d+\.\d+/);
    await expect(versionText.first()).toBeVisible({ timeout: 5000 });
  });
});
