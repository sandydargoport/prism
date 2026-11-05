import { test, expect, type Page } from '@playwright/test';
import { getSeededParentId } from './helpers/auth';

/**
 * The setup wizard in the new look (#930): titles in the display face and
 * every button a 44px target, on each step. Driven through "Run setup again"
 * (/setup/rerun), the same wizard a first run uses, so the test does not
 * reset the install. What the last step shows on a first run is covered in
 * jest (calendarAndLookSteps.test.tsx).
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const PIN = process.env.E2E_PIN || '1234';

async function checkStep(page: Page, step: string) {
  const m = await page.evaluate(() => {
    const root = document.querySelector('[data-setup-wizard]')!;
    const probe = document.createElement('span');
    probe.style.fontFamily = 'var(--font-display)';
    document.body.appendChild(probe);
    const face = getComputedStyle(probe).fontFamily;
    probe.remove();
    const titles = [...root.querySelectorAll('h1, h3')].map((h) => getComputedStyle(h).fontFamily);
    const small = [...root.querySelectorAll('button')]
      .filter((b) => b.getAttribute('role') !== 'switch' && !b.hasAttribute('data-inline-link'))
      .map((b) => ({ text: (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 30), h: b.getBoundingClientRect().height }))
      .filter((b) => b.h > 0 && b.h < 44);
    return { face, titles, small };
  });
  expect(m.titles.length, `${step}: has a title`).toBeGreaterThan(0);
  for (const f of m.titles) expect(f, `${step}: title in the display face`).toBe(m.face);
  expect(m.small, `${step}: every button at least 44px`).toEqual([]);
}

test.describe('the setup wizard', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database');
  test.setTimeout(90_000);

  test('display-face titles and 44px buttons on every step', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
    await page.goto('/setup/rerun');
    await expect(page.locator('[data-setup-wizard]')).toBeVisible({ timeout: 60_000 });
    await checkStep(page, 'welcome');
    await page.getByRole('button', { name: 'Get started' }).click();
    await expect(page.getByRole('heading', { name: 'Family Members' })).toBeVisible();
    // The members already added load after the step shows.
    await expect(page.getByRole('button', { name: /^Edit / }).first()).toBeVisible();
    await checkStep(page, 'family');
    const rows = await page.locator('[data-setup-member-row]').evaluateAll((els) => els.map((e) => ({
      h: e.getBoundingClientRect().height, border: getComputedStyle(e).borderTopWidth,
      mark: !!e.querySelector('[data-person-mark]'),
    })));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r, 'a list row: 56px, no box, the person\'s dot').toEqual({ h: expect.any(Number), border: '0px', mark: true });
    for (const r of rows) expect(r.h).toBeGreaterThanOrEqual(56);
    await page.getByRole('button', { name: /^Continue/ }).click();
    await expect(page.getByRole('heading', { name: 'Household Basics' })).toBeVisible();
    await checkStep(page, 'household');
    // Back rather than on: Continue here saves the household settings.
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('heading', { name: 'Family Members' })).toBeVisible();
  });
});
