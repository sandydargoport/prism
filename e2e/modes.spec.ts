import { test, expect } from '@playwright/test';
import { loginViaAPI, logout, getFirstParent, FamilyMember } from './helpers/auth';
import { resetModes } from './helpers/reset';
import { waitForQuiet } from './helpers/network';

test.describe('Away Mode & Babysitter Mode', () => {
  let parent: FamilyMember;

  test.beforeAll(async ({ browser }) => {
    resetModes();
    const page = await browser.newPage();
    parent = await getFirstParent(page);
    await page.close();
  });

  test.afterEach(async ({ page }) => {
    // Always reset modes to prevent overlay blocking subsequent tests
    resetModes();
    await logout(page);
  });

  test('away mode can be activated via API', async ({ page }) => {
    await loginViaAPI(page, parent.name);

    const response = await page.request.post('/api/away-mode', {
      data: { enabled: true },
    });
    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data.enabled).toBe(true);

    // Verify via GET
    const getResponse = await page.request.get('/api/away-mode');
    const state = await getResponse.json();
    expect(state.enabled).toBe(true);
  });

  test('away mode overlay appears when enabled', async ({ page }) => {
    await loginViaAPI(page, parent.name);

    await page.request.post('/api/away-mode', {
      data: { enabled: true },
    });

    // Navigate and wait for overlay to render (polls for state)
    await page.goto('/');
    await waitForQuiet(page);

    // Away mode overlay (z-9998) should eventually appear
    const overlay = page.locator('.z-\\[9998\\]');
    await expect(overlay).toBeVisible({ timeout: 15000 });
  });

  test('away mode can be disabled via API', async ({ page }) => {
    await loginViaAPI(page, parent.name);

    // Enable then disable
    await page.request.post('/api/away-mode', {
      data: { enabled: true },
    });

    const response = await page.request.post('/api/away-mode', {
      data: { enabled: false },
    });
    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data.enabled).toBe(false);
  });

  test('babysitter mode can be activated via API', async ({ page }) => {
    await loginViaAPI(page, parent.name);

    const response = await page.request.post('/api/babysitter-mode', {
      data: { enabled: true },
    });
    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data.enabled).toBe(true);
  });

  test('babysitter mode overlay appears when enabled', async ({ page }) => {
    await loginViaAPI(page, parent.name);

    await page.request.post('/api/babysitter-mode', {
      data: { enabled: true },
    });

    await page.goto('/');
    await waitForQuiet(page);

    // Babysitter mode overlay (z-9997) should be visible
    const overlay = page.locator('.z-\\[9997\\]');
    await expect(overlay).toBeVisible({ timeout: 10000 });

    // Should show babysitter info heading
    await expect(page.getByText(/Babysitter Information/i)).toBeVisible();
  });
});
