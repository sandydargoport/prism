/**
 * Mobile PWA settings reachability spec.
 *
 * Regression coverage for the bug pattern shipped in #52 phase 1: Prism
 * installed as a PWA on iPhone had no path to /settings at all because
 * MobileNav.tsx's secondaryItems only contained Recipes. The bug surfaced
 * during iCloud photo source setup ("PWA can't reach Photos settings"),
 * but the root cause was that ALL settings sections were unreachable.
 *
 * What this asserts:
 *   1. The mobile nav exposes a path to /settings.
 *   2. After landing on /settings, the section selector lets the user
 *      switch sections (the desktop sidebar is hidden on <md).
 *   3. The new Integrations section renders its provider cards.
 *
 * Run gating matches the rest of the e2e suite — synthetic seed only.
 */

import { test, expect, devices } from '@playwright/test';
import { loginViaAPI } from './helpers/auth';

const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';

// iPhone 14 is the closest modern preset Playwright ships. The viewport
// width (390) crosses the md: breakpoint (768) so the mobile layout fires.
const iphone = devices['iPhone 14'];

test.describe('Mobile PWA settings reachability', () => {
  test.use({
    ...iphone,
    // PWA standalone mode — drops browser chrome, which is the failure
    // mode the original bug was reported under.
    contextOptions: {
      ...iphone,
      reducedMotion: 'reduce',
    },
  });

  test('More menu exposes Settings, section selector switches sections', async ({ page }) => {
    test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a fresh-seeded DB');

    // Pull the seeded parent name from /api/family (works because we
    // haven't authenticated yet — the public response returns names).
    const family = await page.request.get('/api/family').then((r) => r.json());
    const members = Array.isArray(family) ? family : family.members;
    const parentName = members[0].name;

    await loginViaAPI(page, parentName);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // The "More" trigger is rendered as a button at the right of MobileNav.
    const moreButton = page.locator('button:has-text("More")');
    await expect(moreButton).toBeVisible();
    await moreButton.click();

    // The More menu opens with secondary items. Settings must be among them.
    const settingsLink = page.locator('a:has-text("Settings")');
    await expect(settingsLink).toBeVisible();

    await settingsLink.click();
    await page.waitForURL(/\/settings/);
    await page.waitForLoadState('networkidle');

    // The desktop sidebar is hidden on <md; the mobile <select> must be
    // present and offer every section by id.
    const sectionSelect = page.locator('#settings-section-select');
    await expect(sectionSelect).toBeVisible();

    // The legacy 'connections' option AND the new 'integrations' option
    // must both be reachable from the dropdown.
    await expect(sectionSelect.locator('option[value="connections"]')).toHaveCount(1);
    await expect(sectionSelect.locator('option[value="integrations"]')).toHaveCount(1);
    await expect(sectionSelect.locator('option[value="photos"]')).toHaveCount(1);

    // Switching to Integrations renders the new section.
    await sectionSelect.selectOption('integrations');
    await expect(page.locator('h2:has-text("Integrations")')).toBeVisible();

    // The Microsoft and Google cards (the most-used providers) anchor
    // the section — assert they render so a future IA-shuffle regression
    // is caught.
    await expect(page.locator('#microsoft')).toBeVisible();
    await expect(page.locator('#google')).toBeVisible();
  });
});
