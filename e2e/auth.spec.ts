import { test, expect } from '@playwright/test';
import { loginViaAPI, loginViaUI, logout, getFirstParent, getFirstChild, FamilyMember } from './helpers/auth';
import { resetAll } from './helpers/reset';

const MODAL_SELECTOR = '[data-testid="pin-modal"]';

test.describe('Authentication', () => {
  let parent: FamilyMember;
  let child: FamilyMember;

  test.beforeAll(async ({ browser }) => {
    resetAll();
    const page = await browser.newPage();
    parent = await getFirstParent(page);
    child = await getFirstChild(page);
    await page.close();
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('PIN pad opens when clicking Log in', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.click('button[aria-label="Log in"]');

    // QuickPinModal overlay should appear
    const modal = page.locator(MODAL_SELECTOR);
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Should show "Select your profile" description text
    await expect(modal.getByText(/select your profile/i)).toBeVisible();
  });

  test('PIN pad closes when clicking overlay background', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.click('button[aria-label="Log in"]');
    const modal = page.locator(MODAL_SELECTOR);
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Click the overlay background (not the card) to dismiss
    // The overlay has onClick={() => onOpenChange(false)}
    await modal.click({ position: { x: 10, y: 10 } });

    await expect(modal).not.toBeVisible({ timeout: 3000 });
  });

  test('parent login via UI with correct PIN succeeds', async ({ page }) => {
    await loginViaUI(page, parent.name);

    // After login, the Log out button should appear
    await expect(page.locator('button[aria-label="Log out"]')).toBeVisible({ timeout: 5000 });
  });

  test('incorrect PIN shows error', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.click('button[aria-label="Log in"]');

    const modal = page.locator(MODAL_SELECTOR);
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Select the parent in the modal
    await modal.locator(`button:has-text("${parent.name}")`).click();

    // Enter wrong PIN via keyboard
    for (const digit of '9999') {
      await page.keyboard.press(digit);
      await page.waitForTimeout(150);
    }

    // Should show "Incorrect PIN" error text
    await expect(modal.locator('.text-destructive')).toBeVisible({ timeout: 5000 });
  });

  test('child login via API succeeds', async ({ page }) => {
    await loginViaAPI(page, child.name);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Child should be logged in — Log out button visible
    await expect(page.locator('button[aria-label="Log out"]')).toBeVisible({ timeout: 5000 });
  });
});
