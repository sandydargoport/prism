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

  // #1197: a passcode is typed on the pad's letters, which widen the card.
  test('a child with a passcode signs in on the letter pad', async ({ page }) => {
    const PIN = process.env.E2E_PIN || '1234';
    await loginViaAPI(page, parent.name);
    const fam = await (await page.request.get('/api/family')).json();
    const kid = ((fam.members ?? fam) as Array<{ id: string; name: string; pinLength?: number }>).find((m) => m.name === child.name)!;
    const set = (data: Record<string, unknown>) => page.request.patch(`/api/family/${kid.id}`, { data });
    expect((await set({ pinKind: 'passcode', pinLength: 6, pin: 'kite42' })).ok()).toBe(true);
    try {
      await logout(page);
      await page.goto('/');
      await page.click('button[aria-label="Log in"]');
      const modal = page.locator(MODAL_SELECTOR);
      await expect(modal).toBeVisible({ timeout: 5000 });
      await modal.locator(`button:has-text("${child.name}")`).click();

      await modal.getByRole('button', { name: 'Letters' }).click();
      const letters = modal.locator('[data-pin-letters]');
      await expect(letters).toBeVisible();
      const m = await modal.evaluate((el) => {
        const card = (el.querySelector('[data-pin-letters]') as HTMLElement).closest('.bg-card')!.getBoundingClientRect();
        const pad = el.querySelector('[data-pin-letters]')!.getBoundingClientRect();
        const keys = [...el.querySelectorAll('[data-pin-letters] button')].map((b) => b.getBoundingClientRect());
        return {
          inside: pad.left >= card.left - 0.5 && pad.right <= card.right + 0.5,
          narrowest: Math.min(...keys.map((k) => k.width)),
          lowest: Math.min(...keys.map((k) => k.height)),
          overflow: document.documentElement.scrollWidth - window.innerWidth,
        };
      });
      expect(m.inside, 'the letters fit in the card').toBe(true);
      expect(m.narrowest, 'a letter key is wide enough to tap').toBeGreaterThanOrEqual(30);
      expect(m.lowest, 'and tall enough').toBeGreaterThanOrEqual(40);
      expect(m.overflow).toBeLessThanOrEqual(0);

      for (const ch of ['k', 'i', 't', 'e']) await modal.getByRole('button', { name: ch, exact: true }).click();
      await modal.getByRole('button', { name: 'Numbers' }).click();
      for (const d of ['4', '2']) await modal.getByRole('button', { name: d, exact: true }).click();
      await expect(page.locator('button[aria-label="Log out"]')).toBeVisible({ timeout: 10_000 });
    } finally {
      await logout(page);
      await loginViaAPI(page, parent.name);
      await set({ pinKind: 'digits', pinLength: kid.pinLength ?? PIN.length, pin: PIN });
    }
  });

  test('child login via API succeeds', async ({ page }) => {
    await loginViaAPI(page, child.name);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Child should be logged in — Log out button visible
    await expect(page.locator('button[aria-label="Log out"]')).toBeVisible({ timeout: 5000 });
  });
});

// Keep this device signed in, and sign out another one (#1044): a phone used
// every day stays signed in for a year, and a lost one is a tap away.
test.describe('Signed-in devices', () => {
  test.skip(process.env.E2E_HAS_TEST_DB !== '1', 'needs the seeded test database');
  test.setTimeout(120_000);

  test('keep this device signed in for a year; sign another device out', async ({ page, browser }) => {
    const PIN = process.env.E2E_PIN || '1234';
    const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
    const { getSeededParentId, verifySettingsPinViaAPI } = await import('./helpers/auth');
    const other = await browser.newContext({ userAgent: IPHONE });
    try {
      // The other device: a phone signed in as the same parent.
      const phone = await other.newPage();
      expect((await phone.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
      const mine = await phone.request.get('/api/auth/sessions');
      expect(mine.ok()).toBe(true);
      const phoneId = ((await mine.json()).sessions as { id: string; current: boolean; device: string }[]).find((x) => x.current)!;
      expect(phoneId.device).toBe('iPhone · Safari');

      expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
      await verifySettingsPinViaAPI(page, (await getFirstParent(page)).name);
      await page.goto('/settings?section=security');
      const card = page.locator('[data-signed-in-devices]');
      await expect(card).toBeVisible({ timeout: 30_000 });

      // Before: the session cookie lasts a week at most.
      const cookieDays = async () => {
        const c = (await page.context().cookies()).find((k) => k.name === 'prism_session')!;
        return (c.expires * 1000 - Date.now()) / 86_400_000;
      };
      expect(await cookieDays()).toBeLessThanOrEqual(7.01);
      await card.locator('[data-keep-signed-in]').click();
      await expect(card.locator('[data-keep-signed-in]')).toHaveAttribute('aria-pressed', 'true');
      expect(await cookieDays()).toBeGreaterThan(360);

      // The phone shows by name; signing it out ends its session.
      const row = card.locator(`[data-device-row="${phoneId.id}"]`);
      await expect(row).toContainText('iPhone · Safari');
      await row.locator('[data-device-sign-out]').click();
      await expect(row).toHaveCount(0);
      expect((await phone.request.get('/api/auth/sessions')).status()).toBe(401);
      // And this device is still signed in and kept.
      await page.reload();
      await expect(page.locator('[data-keep-signed-in]')).toHaveAttribute('aria-pressed', 'true');

      // However many sessions pile up, the list stays short, and one button
      // signs out everything but this device.
      for (let i = 0; i < 7; i++) {
        const ctx = await browser.newContext();
        await ctx.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } });
        await ctx.close();
      }
      await page.reload();
      await expect(card.locator('[data-device-row]')).toHaveCount(5);
      expect((await card.boundingBox())!.height).toBeLessThan(900);
      await expect(card.locator('[data-device-more]')).toContainText('more');
      await card.locator('[data-device-sign-out-others]').click();
      await expect(card.locator('[data-device-row]')).toHaveCount(0);
      await expect(card.locator('[data-device-current]')).toBeVisible();
    } finally {
      await other.close();
    }
  });
});
