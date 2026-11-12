import { test, expect } from '@playwright/test';
import { getFirstParent, getSeededParentId } from './helpers/auth';

/**
 * One sheet, pill buttons and sentence toasts (#908), measured on a touch
 * wall at 1080p: the sheet's padding, its 48px close, 44px pills, which side
 * it opens on, and the toast's place and 44px Undo.
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const PIN = process.env.E2E_PIN || '1234';

test.describe('sheet and toast on the wall', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database to log in and create an event');
  test.setTimeout(120_000);

  test('a sheet opens on the side it was touched, and hiding an event gives an Undo toast', async ({ playwright }, info) => {
    // A touch wall: Blink told the pointer is coarse, as a tablet reports (calendar-geometry does the same).
    const browser = await playwright.chromium.launch({ args: ['--blink-settings=primaryPointerType=2,availablePointerTypes=2'] });
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, hasTouch: true, baseURL: info.project.use.baseURL });
    const page = await context.newPage();
    const parentId = getSeededParentId();
    const login = await page.request.post('/api/auth/login', { data: { userId: parentId, pin: PIN } });
    expect(login.ok(), 'precondition: login must succeed').toBe(true);

    const now = new Date();
    const title = `Sheet check ${Date.now()}`;
    const created = await page.request.post('/api/events', {
      data: {
        title,
        startTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 0).toISOString(),
        endTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 30).toISOString(),
        allDay: false,
        createdBy: parentId,
      },
    });
    expect(created.status()).toBe(201);
    const event = await created.json();

    try {
      await page.goto('/calendar');
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), 'premise: coarse pointer').toBe(true);
      const chip = page.getByText(title).first();
      await chip.waitFor({ timeout: 60_000 });

      // Add Event is a sheet; the side follows where the button was touched.
      const add = page.getByRole('button', { name: /Add Event/i }).first();
      // Measured before the tap: once the sheet is open the page behind is hidden from roles.
      const box = await add.boundingBox();
      await add.click();
      const sheet = page.locator('[data-sheet]');
      await expect(sheet).toBeVisible();
      // Measured where it comes to rest, not mid-slide.
      await sheet.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
      const m = await sheet.evaluate((el) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        const close = el.querySelector('[data-sheet-close]')!.getBoundingClientRect();
        // The shared pills; other controls are #837's (touch targets on the wall).
        const buttons = [...el.querySelectorAll('[data-pill]')]
          .map((b) => b.getBoundingClientRect())
          .filter((b) => b.width > 0);
        return {
          side: el.getAttribute('data-sheet-side'),
          pad: Math.min(...['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'].map((k) => parseFloat(cs[k as 'paddingTop']))),
          radius: parseFloat(cs.borderTopLeftRadius),
          blur: cs.backdropFilter,
          close: { w: close.width, h: close.height },
          minButton: Math.min(...buttons.map((b) => b.height)),
          pills: buttons.length,
          left: r.left, right: r.right, bottom: r.bottom,
          titleFont: getComputedStyle(el.querySelector('h2')!).fontFamily,
        };
      });
      const tapped = box!.x + box!.width / 2;
      const expected = tapped < 1920 / 3 ? 'left' : tapped > (1920 * 2) / 3 ? 'right' : 'bottom';
      expect(m.side, 'opens on the side that was touched').toBe(expected);
      if (expected === 'left') expect(m.left).toBeLessThan(80);
      if (expected === 'right') expect(1920 - m.right).toBeLessThan(80);
      if (expected === 'bottom') expect(1080 - m.bottom).toBeLessThan(80);
      expect(m.pad, 'generous padding').toBeGreaterThanOrEqual(28);
      expect(m.radius).toBeGreaterThanOrEqual(20);
      expect(m.blur === 'none' || m.blur === '', 'no blur').toBe(true);
      expect(m.close.w).toBeGreaterThanOrEqual(48);
      expect(m.close.h).toBeGreaterThanOrEqual(48);
      expect(m.pills, 'the sheet has pills').toBeGreaterThan(0);
      expect(m.minButton, 'every pill is a 44px target').toBeGreaterThanOrEqual(44);
      expect(m.titleFont, 'title in the display face').toMatch(/Literata/i);

      await page.keyboard.press('Escape');
      await expect(sheet).toBeHidden();

      // Hide the event: the toast says so and offers Undo, in the top band, centred.
      await chip.click();
      await page.getByText('Hide in Prism').click();
      const toast = page.locator('[data-toast-text]').filter({ hasText: title }).locator('..');
      await expect(toast).toBeVisible();
      await toast.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
      const t = await toast.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const undo = [...el.querySelectorAll('button')].find((b) => /undo/i.test(b.textContent ?? ''))!.getBoundingClientRect();
        return { top: r.top, mid: (r.left + r.right) / 2, undo: { w: undo.width, h: undo.height } };
      });
      expect(t.top, 'in the top band').toBeLessThan(120);
      expect(Math.abs(t.mid - 960), 'centred').toBeLessThan(40);
      expect(t.undo.h).toBeGreaterThanOrEqual(44);
      expect(t.undo.w).toBeGreaterThanOrEqual(44);
      await toast.getByRole('button', { name: /undo/i }).click();
    } finally {
      await page.request.delete(`/api/events/${event.id}`);
      await browser.close();
    }
  });

  // Hide in Prism shows to a screen nobody signed in to, and asks for a
  // parent's PIN on the tap (#1048): it was there only once a parent had
  // signed in, so a wall or phone never showed it.
  test('signed out, Hide is there and asks for a parent\'s PIN', async ({ page, browser }) => {
    // A parent makes the event from another browser; this page stays signed out.
    const parentSide = await browser.newContext();
    const parentId = getSeededParentId();
    expect((await parentSide.request.post('/api/auth/login', { data: { userId: parentId, pin: PIN } })).ok()).toBe(true);
    const now = new Date();
    const title = `Hide signed out ${Date.now()}`;
    const created = await parentSide.request.post('/api/events', {
      data: {
        title,
        startTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 0).toISOString(),
        endTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 30).toISOString(),
        allDay: false,
        createdBy: parentId,
      },
    });
    expect(created.status()).toBe(201);
    const event = await created.json();
    try {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/calendar');
      const chip = page.getByText(title).first();
      await chip.waitFor({ timeout: 60_000 });
      await chip.click();
      const hide = page.getByText('Hide in Prism');
      await expect(hide, 'Hide shows with nobody signed in').toBeVisible();
      await hide.click();
      const pin = page.locator('[data-testid="pin-modal"]');
      await expect(pin, 'the tap asks for a PIN').toBeVisible();
      await pin.locator(`button:has-text("${(await getFirstParent(page)).name}")`).click();
      for (const digit of PIN) { await page.keyboard.press(digit); await page.waitForTimeout(150); }
      await expect(page.locator('[data-toast-text]').filter({ hasText: title })).toBeVisible({ timeout: 15_000 });
      const hidden = await (await parentSide.request.get('/api/events/hidden')).json();
      expect(JSON.stringify(hidden), 'the event is hidden').toContain(event.id);
    } finally {
      await parentSide.request.delete(`/api/events/${event.id}/hidden`);
      await parentSide.request.delete(`/api/events/${event.id}`);
      await parentSide.close();
    }
  });
});
