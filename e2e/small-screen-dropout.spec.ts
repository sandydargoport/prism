import { test, expect, type Page } from '@playwright/test';
import { getSeededParentId } from './helpers/auth';

/**
 * #803: on a small wall screen (under about 75% of 1920x1080) a widget set to
 * "Hide first on a small screen" drops out, and the rows only it used close
 * up, so the widgets above grow into the room. On a full-size screen it stays.
 * No text falls under the floor either way.
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const PIN = process.env.E2E_PIN || '1234';

const widgets = (hide: boolean) => [
  { i: 'clock', x: 0, y: 0, w: 6, h: 4 },
  { i: 'weather', x: 6, y: 0, w: 6, h: 4 },
  { i: 'tasks', x: 0, y: 4, w: 12, h: 3, ...(hide ? { hideOnSmallScreen: true } : {}) },
];

async function open(page: Page, hide: boolean, width: number, height: number) {
  await page.setViewportSize({ width, height });
  const res = await page.request.post('/api/layouts', { data: { name: `Small screen ${hide} ${Date.now()}`, widgets: widgets(hide), view: 'grid' } });
  expect(res.ok()).toBe(true);
  const layout = await res.json();
  await page.goto(`/d/${layout.slug}`);
  await expect(page.locator('[data-widget="clock"]')).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(1500);
  return layout.id as string;
}

const clockHeight = (page: Page) => page.locator('[data-widget="clock"]').evaluate((e) => e.getBoundingClientRect().height);

async function smallestText(page: Page) {
  return page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.fontSize = 'var(--text-floor)';
    document.body.appendChild(probe);
    const floor = parseFloat(getComputedStyle(probe).fontSize);
    probe.remove();
    let min = Infinity;
    for (const cell of document.querySelectorAll('[data-widget]')) {
      const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement;
        if (!el || !n.textContent?.trim() || el.getBoundingClientRect().width === 0) continue;
        min = Math.min(min, parseFloat(getComputedStyle(el).fontSize));
      }
    }
    return { floor, min };
  });
}

test.describe('small-screen drop-out', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database');
  test.setTimeout(150_000);

  test('at 1280x720 the "Hide first" widget drops out and the rest grow; at 1920x1080 it stays', async ({ page }) => {
    expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
    const made: string[] = [];
    try {
      // The same layout without the setting, as the baseline.
      made.push(await open(page, false, 1280, 720));
      await expect(page.locator('[data-widget="tasks"]')).toBeVisible();
      const before = await clockHeight(page);

      made.push(await open(page, true, 1280, 720));
      await expect(page.locator('[data-widget="tasks"]'), 'dropped on a small screen').toHaveCount(0);
      const after = await clockHeight(page);
      expect(after, 'the rest grew into the room').toBeGreaterThan(before * 1.3);
      const text = await smallestText(page);
      expect(text.min, 'no text under the floor').toBeGreaterThanOrEqual(text.floor);

      // A full-size wall keeps it.
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.reload();
      await expect(page.locator('[data-widget="tasks"]'), 'kept on a full-size screen').toBeVisible({ timeout: 60_000 });
    } finally {
      for (const id of made) await page.request.delete(`/api/layouts/${id}`);
    }
  });
});
