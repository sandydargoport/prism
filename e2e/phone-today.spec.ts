import { test, expect } from '@playwright/test';
import { getSeededParentId } from './helpers/auth';
import { TODAY_TEMPLATE } from '../src/lib/constants/layoutTemplates';

/**
 * Today on a phone (#928): a short photo header with the date and the next
 * event, then the coming days as sentences and the chores and shopping lines,
 * at 390x844. The next event opens the shared event sheet.
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const PIN = process.env.E2E_PIN || '1234';

// The iPhone home-screen app reports the status bar's height only with the
// translucent style; without it the top line sat blurred under the status bar
// (#1041). Any page carries it: it is in the root layout.
test('declares the translucent iPhone status bar, so safe-area padding clears it', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute('content', 'black-translucent');
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
});

test.describe('Today on a phone', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database');
  test.setTimeout(90_000);

  test('header, sentences and lines in order, nothing under the floor, no sideways scroll, the next event opens its sheet', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
    const tag = Date.now();
    // Under way all day from 00:01, so it is the earliest event still going
    // whenever the test runs; and one tomorrow so the sentences have a day.
    const later = new Date(); later.setHours(0, 1, 0, 0);
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(16, 0, 0, 0);
    const made: string[] = [];
    const endOfToday = new Date(); endOfToday.setHours(23, 58, 0, 0);
    for (const [title, start, end] of [[`Phone next ${tag}`, later, endOfToday], [`Phone tomorrow ${tag}`, tomorrow, new Date(tomorrow.getTime() + 30 * 60_000)]] as const) {
      const res = await page.request.post('/api/events', {
        data: { title, startTime: start.toISOString(), endTime: end.toISOString(), allDay: false, createdBy: getSeededParentId() },
      });
      expect(res.status()).toBe(201);
      made.push((await res.json()).id);
    }
    const layout = await (await page.request.post('/api/layouts', { data: { name: `Phone Today ${tag}`, widgets: TODAY_TEMPLATE.widgets, view: 'today' } })).json();
    try {
      await page.goto(`/d/${layout.slug}`);
      const root = page.locator('[data-phone-today]');
      await expect(root).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('[data-mobile-cards]'), 'no widget cards').toHaveCount(0);
      await expect(root.locator('[data-phone-today-next]')).toContainText(`Phone next ${tag}`);
      await expect(root.locator('[data-today-coming]')).toBeVisible();

      // In order, top to bottom: header, sentences, lines.
      const tops = await page.evaluate(() => {
        const top = (sel: string) => document.querySelector(sel)?.getBoundingClientRect().top ?? NaN;
        return { header: top('[data-phone-today-header]'), coming: top('[data-today-coming]'), quiet: top('[data-today-quiet]') };
      });
      expect(tops.header).toBeLessThan(tops.coming);
      if (!Number.isNaN(tops.quiet)) expect(tops.coming).toBeLessThan(tops.quiet);

      const fit = await page.evaluate(() => {
        const probe = document.createElement('div');
        probe.style.fontSize = 'var(--text-floor)';
        document.body.appendChild(probe);
        const floor = parseFloat(getComputedStyle(probe).fontSize);
        probe.remove();
        let min = Infinity; let where = '';
        const walker = document.createTreeWalker(document.querySelector('[data-phone-today]')!, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const el = n.parentElement;
          if (!el || !n.textContent?.trim() || el.getBoundingClientRect().width === 0) continue;
          const size = parseFloat(getComputedStyle(el).fontSize);
          if (size < min) { min = size; where = n.textContent.trim().slice(0, 40); }
        }
        return { floor, min, where, scrollW: document.documentElement.scrollWidth, w: window.innerWidth };
      });
      expect(fit.min, `smallest text "${fit.where}"`).toBeGreaterThanOrEqual(fit.floor);
      expect(fit.scrollW, 'no sideways scroll').toBeLessThanOrEqual(fit.w);

      // With no photo behind it, the header is in the page's ink, not white
      // on paper.
      const ink = await page.evaluate(() => ({
        photo: !!document.documentElement.dataset.wallpaper,
        header: getComputedStyle(document.querySelector('[data-phone-today-next]')!).color,
        page: getComputedStyle(document.body).color,
      }));
      if (!ink.photo) expect(ink.header).toBe(ink.page);

      const next = root.locator('[data-phone-today-next]');
      expect((await next.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await next.click();
      await expect(page.locator('[data-event-sheet]').getByRole('heading', { name: `Phone next ${tag}` })).toBeVisible();
    } finally {
      await page.request.delete(`/api/layouts/${layout.id}`);
      for (const id of made) await page.request.delete(`/api/events/${id}`);
    }
  });
});
