import { test, expect, type Page } from '@playwright/test';
import { loginViaAPI, logout, getFirstParent, getSeededParentId, FamilyMember } from './helpers/auth';
import { resetAll, resetAppearance } from './helpers/reset';

const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const PIN = process.env.E2E_PIN || '1234';

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
    await page.waitForLoadState('networkidle');

    // The main content area should be present
    await expect(page.locator('main').first()).toBeVisible();

    // CSS Grid dashboard renders widget cells with data-widget attribute
    const widgets = page.locator('[data-widget]');
    await expect(widgets.first()).toBeVisible({ timeout: 10000 });
    expect(await widgets.count()).toBeGreaterThan(0);
  });

  test('sidebar nav links navigate to correct pages', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

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
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/chores/);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('dashboard home link returns to dashboard', async ({ page }) => {
    await page.goto('/tasks');
    await page.waitForLoadState('networkidle');

    // Click the logo/home link
    await page.click('a[href="/"]');
    await expect(page).toHaveURL(/\/$/);
  });
});

/**
 * The 2.0 look (#799), measured on a wall screen: a browser with no pointer at
 * 1920x1080, which is where Classic climbs to its 22px text step.
 *
 * The photo is stood in for by the attribute WallpaperBackground sets while one
 * is showing (its own unit test covers setting it): what is measured here is
 * what the stylesheet does with it, in each look.
 */
test.describe('Appearance: Classic and 2.0 (#799)', () => {
  test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a fresh-seeded DB');
  test.beforeAll(() => resetAppearance());
  test.afterAll(() => resetAppearance());

  async function measure(page: Page) {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.locator('.widget-card').first().waitFor({ timeout: 60_000 });
    return page.evaluate(() => {
      const root = document.documentElement;
      root.setAttribute('data-wallpaper', '');
      const card = getComputedStyle(document.querySelector('.widget-card')!);
      const chrome = getComputedStyle(document.querySelector('.app-chrome')!);
      return {
        pointerNone: matchMedia('(pointer: none)').matches,
        appearance: root.getAttribute('data-appearance'),
        rootPx: parseFloat(getComputedStyle(root).fontSize),
        cardBg: card.backgroundColor,
        cardBlur: card.backdropFilter,
        cardText: card.color,
        chromeBg: chrome.backgroundColor,
      };
    });
  }

  test('switching to 2.0 in Settings gives glass cards and the 16px text step', async ({ playwright }, info) => {
    test.setTimeout(180_000);
    const browser = await playwright.chromium.launch({
      args: ['--blink-settings=primaryPointerType=1,availablePointerTypes=1'],
    });
    try {
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        baseURL: info.project.use.baseURL,
        timezoneId: info.project.use.timezoneId,
      });
      const page = await context.newPage();
      const userId = getSeededParentId();
      expect((await page.request.post('/api/auth/login', { data: { userId, pin: PIN } })).ok()).toBe(true);
      expect((await page.request.post('/api/auth/verify-pin', { data: { userId, pin: PIN } })).ok()).toBe(true);

      // Classic (the seed): the 22px step, theme cards even over a photo.
      const classic = await measure(page);
      expect(classic.pointerNone, 'premise: a wall screen with no pointer').toBe(true);
      expect(classic.appearance).toBe('classic');
      expect(classic.rootPx).toBe(22);
      expect(classic.cardBlur).not.toContain('26px');
      expect(classic.chromeBg).not.toBe('rgba(0, 0, 0, 0)');

      // Switch the way a parent would.
      await page.goto('/settings', { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Appearance' }).first().click();
      const v2Button = page.getByRole('radio', { name: '2.0' });
      await v2Button.click();
      await expect(v2Button).toHaveAttribute('aria-checked', 'true');
      await expect(page.locator('html')).toHaveAttribute('data-appearance', 'v2');

      // Rendered by the server on the next load, not only set by the click.
      const html = await (await page.request.get('/')).text();
      expect(html).toContain('data-appearance="v2"');

      const v2 = await measure(page);
      expect(v2.appearance).toBe('v2');
      expect(v2.rootPx).toBe(16);
      expect(v2.cardBg).toBe('rgba(14, 14, 18, 0.42)');
      expect(v2.cardBlur).toContain('blur(26px)');
      expect(v2.cardText).toBe('rgb(255, 255, 255)');
      expect(v2.chromeBg).toBe('rgba(0, 0, 0, 0)');

      // Performance Reduced: no blur at all, and denser glass in its place.
      await page.addInitScript(() => localStorage.setItem('prism-perf-mode', 'reduced'));
      const reduced = await measure(page);
      expect(reduced.cardBlur).toBe('none');
      expect(reduced.cardBg).toBe('rgba(14, 14, 18, 0.8)');
    } finally {
      await browser.close();
    }
  });
});
