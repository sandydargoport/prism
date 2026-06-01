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
const PIN = process.env.E2E_PIN || '1234';

// iPhone 14 is the closest modern preset Playwright ships. The viewport
// width (390) crosses the md: breakpoint (768) so the mobile layout fires.
// `test.use` must live at file scope: it carries `defaultBrowserType` from
// the device preset which forces a new worker — Playwright rejects that
// inside a describe block.
test.use({
  ...devices['iPhone 14'],
  contextOptions: { reducedMotion: 'reduce' },
});

test.describe('Mobile PWA settings reachability', () => {
  test('More menu exposes Settings, section selector switches sections', async ({ page }) => {
    test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a fresh-seeded DB');

    // Pull the seeded parent name from /api/family (works because we
    // haven't authenticated yet — the public response returns names).
    const family = await page.request.get('/api/family').then((r) => r.json());
    const members = Array.isArray(family) ? family : family.members;
    const parentName = members[0].name;

    const parent = await loginViaAPI(page, parentName);

    // SettingsPinGate sits in front of /settings and requires a parent PIN
    // re-verification on top of the session cookie. POST it directly so the
    // gate flips to 'verified' before the page even loads — otherwise the
    // PIN prompt renders instead of SettingsView and the section selector
    // is never in the DOM.
    const verifyRes = await page.request.post('/api/auth/verify-pin', {
      data: parent.id
        ? { userId: parent.id, pin: PIN }
        : { memberIndex: parent.loginIndex, pin: PIN },
    });
    if (!verifyRes.ok()) {
      throw new Error(`Settings verify-pin failed: ${verifyRes.status()}`);
    }

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Mobile nav at <md is MobileFab — a floating action button that opens
    // a stack of action items. The FAB itself is aria-labeled "Open menu".
    const fab = page.locator('button[aria-label="Open menu"]');
    await expect(fab).toBeVisible();
    await fab.click();

    // Settings action is a <Link href="/settings"> rendered inside the open
    // stack. Click it to navigate.
    const settingsLink = page.locator('a[href="/settings"]');
    await expect(settingsLink).toBeVisible();
    await settingsLink.click();

    await page.waitForURL(/\/settings/);
    await page.waitForLoadState('networkidle');

    // The desktop sidebar is hidden on <md; the mobile <select> must be
    // present and offer every section by id.
    const sectionSelect = page.locator('#settings-section-select');
    await expect(sectionSelect).toBeVisible();

    // Integrations + Photos must both be reachable from the dropdown.
    // ('connections' was retired in Phase 2B-1 — the legacy section was
    // fully replaced by Integrations, with ?section=connections URLs
    // redirected via SettingsView's LEGACY_TO_INTEGRATIONS map.)
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
