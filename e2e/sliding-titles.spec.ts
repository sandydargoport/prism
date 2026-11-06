import { test, expect, type Page } from '@playwright/test';
import { getSeededParentId } from './helpers/auth';

/**
 * Long event titles slide instead of being cut (#901): a title too long for
 * its event moves until its end is in view, keeps its size, and stays still
 * under reduced motion.
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const PIN = process.env.E2E_PIN || '1234';

async function withLongEvent(page: Page, run: (title: string) => Promise<void>) {
  expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
  const title = `Sliding ${Date.now()} the end of term concert rehearsal in the big hall`;
  const start = new Date(); start.setHours(9, 0, 0, 0);
  const res = await page.request.post('/api/events', {
    data: { title, startTime: start.toISOString(), endTime: new Date(start.getTime() + 3600_000).toISOString(), allDay: false, createdBy: getSeededParentId() },
  });
  expect(res.status()).toBe(201);
  const id = (await res.json()).id;
  try {
    await page.addInitScript(() => localStorage.setItem('prism-calendar-view-type', 'month'));
    await page.goto('/calendar');
    await run(title);
  } finally {
    await page.request.delete(`/api/events/${id}`);
  }
}

test.describe('sliding event titles', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database');
  test.setTimeout(120_000);

  test('a long title in a narrow event slides to its end and keeps its size', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await withLongEvent(page, async (title) => {
      const el = page.locator('[data-sliding-title]').filter({ hasText: title }).first();
      await expect(el).toBeVisible({ timeout: 60_000 });
      const rest = await el.evaluate((e) => ({ size: getComputedStyle(e).fontSize, over: e.scrollWidth - e.clientWidth }));
      expect(rest.over, 'the title is too long for its event').toBeGreaterThan(10);

      // Its turn comes from a shared queue: a few at a time.
      await expect(el).toHaveAttribute('data-sliding-title', 'sliding', { timeout: 90_000 });
      let furthest = 0;
      let size = rest.size;
      for (let i = 0; i < 120; i++) {
        const m = await el.evaluate((e) => {
          const inner = e.firstElementChild as HTMLElement;
          return { x: new DOMMatrix(getComputedStyle(inner).transform).m41, size: getComputedStyle(inner).fontSize };
        });
        furthest = Math.min(furthest, m.x);
        size = m.size;
        if (-furthest >= rest.over - 1) break;
        await page.waitForTimeout(100);
      }
      expect(-furthest, 'it slides until its end is in view').toBeGreaterThanOrEqual(rest.over - 1);
      expect(size, 'sliding never shrinks it').toBe(rest.size);
      const floor = await page.evaluate(() => {
        const p = document.createElement('div'); p.style.fontSize = 'var(--text-floor)'; document.body.appendChild(p);
        const f = parseFloat(getComputedStyle(p).fontSize); p.remove(); return f;
      });
      expect(parseFloat(size)).toBeGreaterThanOrEqual(floor);
    });
  });

  test('under reduced motion nothing slides', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1280, height: 900 });
    await withLongEvent(page, async (title) => {
      const el = page.locator('[data-sliding-title]').filter({ hasText: title }).first();
      await expect(el).toBeVisible({ timeout: 60_000 });
      await page.waitForTimeout(4000);
      expect(await page.locator('[data-sliding-title="sliding"]').count()).toBe(0);
      expect(await el.evaluate((e) => e.firstElementChild!.getAnimations().length)).toBe(0);
    });
  });
});
