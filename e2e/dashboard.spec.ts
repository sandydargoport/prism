import { test, expect } from '@playwright/test';
import { loginViaAPI, logout, getFirstParent, getSeededParentId, FamilyMember } from './helpers/auth';
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

/**
 * Outline None on the wall (#1339): every card draws a border from the
 * theme's border width, and that border is the outline people see on each
 * widget. A widget set to None, as Apply to all widgets sets every one, draws
 * none, whatever width the theme gives its cards.
 */
test.describe('widget Outline: None on a dashboard', () => {
  test.skip(process.env.E2E_HAS_TEST_DB !== '1', 'needs the seeded test database');
  test.setTimeout(90_000);

  test('a card set to None draws no border, with the theme border at 2px', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: process.env.E2E_PIN || '1234' } })).ok()).toBe(true);
    const widgets = [
      { i: 'messages', x: 0, y: 0, w: 16, h: 12, visible: true, outlineColor: 'transparent' },
      { i: 'tasks', x: 20, y: 0, w: 16, h: 12, visible: true },
    ];
    const layout = await (await page.request.post('/api/layouts', { data: { name: `Outline ${Date.now()}`, widgets } })).json();
    try {
      await page.goto(`/d/${layout.slug}`);
      const card = (id: string) => `.widget-cell[data-widget="${id}"] [class*="bg-card"].border-border`;
      await page.locator(card('messages')).first().waitFor({ timeout: 60_000 });
      await page.locator(card('tasks')).first().waitFor({ timeout: 60_000 });
      // A theme with a heavier border than most ship.
      await page.evaluate(() => document.documentElement.style.setProperty('--border-width', '2px'));
      const border = (id: string) => page.locator(card(id)).first().evaluate((el) => {
        const s = getComputedStyle(el);
        const alpha = (c: string) => {
          const m = c.match(/rgba?\(([^)]+)\)/);
          if (!m) return 1;
          const parts = m[1]!.split(/[\s,/]+/).filter(Boolean);
          return parts.length > 3 ? Number(parts[3]) : 1;
        };
        return { width: s.borderTopWidth, alpha: alpha(s.borderTopColor), shadow: s.boxShadow };
      });
      const shown = await border('tasks');
      expect(shown, 'precondition: a default card draws the theme border').toMatchObject({ width: '2px' });
      expect(shown.alpha, 'precondition: a default card draws the theme border').toBeGreaterThan(0);
      const none = await border('messages');
      expect(none.alpha, 'Outline None: no border is drawn').toBe(0);
      expect(none.shadow).toBe('none');
    } finally {
      await page.request.delete(`/api/layouts/${layout.id}`);
    }
  });
});
