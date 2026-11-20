import { test, expect, type Page } from '@playwright/test';
import { getSeededParentId } from './helpers/auth';

/**
 * #1265: one editor everywhere. A device that is not a named screen edits a
 * dashboard on a canvas: the dashboard laid out at a screen's size, scaled to
 * fit, with the panels beside it on a laptop and below it on a phone. These
 * measure the canvas.
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const PIN = process.env.E2E_PIN || '1234';

type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
const rect = (page: Page, sel: string) =>
  page.locator(sel).first().evaluate((el) => el.getBoundingClientRect().toJSON() as Rect);

async function dashboard(page: Page) {
  expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
  const res = await page.request.post('/api/layouts', { data: { name: `Canvas ${Date.now()}`, view: 'grid', widgets: [
    { i: 'clock', x: 0, y: 0, w: 16, h: 12 },
    { i: 'tasks', x: 16, y: 0, w: 16, h: 24 },
  ] } });
  expect(res.ok()).toBe(true);
  const layout = await res.json() as { id: string; slug: string };
  return { layout, cleanup: () => page.request.delete(`/api/layouts/${layout.id}`) };
}

/** Opens the dashboard's editor link and waits for the canvas and its panels. */
async function openCanvas(page: Page, slug: string, id: string) {
  await page.goto(`/d/${slug}?edit=1`);
  // Not a named screen: the link goes to the canvas editor in its place.
  await page.waitForURL((u) => u.pathname === `/edit/${id}`, { timeout: 60_000 });
  const frame = page.frameLocator('[data-remote-frame]');
  await expect(frame.locator('[data-editor-widget="clock"]')).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('[data-remote-edit-root] [data-editor-panels]')).toBeVisible({ timeout: 60_000 });
  // The panel for widgets is open from the start.
  await expect(page.locator('[data-editor-sheet="widgets"]')).toBeVisible();
}

const frameSize = async (page: Page) => {
  const frame = (await (await page.locator('[data-remote-frame]').elementHandle())!.contentFrame())!;
  return frame.evaluate(() => [window.innerWidth, window.innerHeight]);
};

test.describe('canvas editor (#1265)', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database');
  test.setTimeout(240_000);

  test('on a laptop: the screen-sized canvas fills the room beside the panels, and no panel moves or covers it', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const { layout, cleanup } = await dashboard(page);
    try {
      await openCanvas(page, layout.slug, layout.id);

      // Laid out at a screen's size: 1920 x 1080 when no named screen shows it.
      await expect(page.locator('[data-canvas-size]')).toHaveValue('1920x1080');
      await expect.poll(() => frameSize(page), { timeout: 30_000 }).toEqual([1920, 1080]);
      const picture = await rect(page, '[data-remote-picture]');
      expect(picture.width / picture.height).toBeCloseTo(1920 / 1080, 2);

      // It fills its room in one direction and fits in the other.
      const room = await rect(page, '[data-canvas-room]');
      expect(Math.abs(picture.width - room.width) < 2 || Math.abs(picture.height - room.height) < 2).toBe(true);
      expect(picture.width).toBeLessThanOrEqual(room.width + 1);
      expect(picture.height).toBeLessThanOrEqual(room.height + 1);
      // Far bigger than the old picture, which stopped at 45% of the height.
      expect(picture.height).toBeGreaterThan(900 * 0.55);

      // The panels sit beside it, clear of it, inside the window.
      const panels = await rect(page, '[data-editor-panels]');
      expect(panels.left).toBeGreaterThanOrEqual(picture.right);
      expect(panels.right).toBeLessThanOrEqual(1440);
      expect(panels.width).toBeGreaterThan(320);

      // Opening each panel leaves the canvas exactly where it was.
      for (const id of ['dashboard', 'widgets', 'day', 'look', 'more'] as const) {
        await page.locator(`[data-editor-open="${id}"]`).click();
        const sheet = page.locator(`[data-editor-sheet="${id}"]`);
        await expect(sheet).toBeVisible();
        expect(await rect(page, '[data-remote-picture]'), `the canvas with ${id} open`).toEqual(picture);
        const s = await rect(page, `[data-editor-sheet="${id}"]`);
        expect(s.left, `${id} is beside the canvas`).toBeGreaterThanOrEqual(picture.right);
        expect(s.bottom, `${id} ends inside the window`).toBeLessThanOrEqual(900 + 0.5);
        if (id === 'day') {
          // Every stretch of the day stays on its line, however short.
          const line = await rect(page, '[data-day-lane="nobody"]');
          for (const st of await page.locator('[data-day-stretch]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as Rect))) {
            expect(st.right).toBeLessThanOrEqual(line.right + 0.5);
            expect(st.left).toBeGreaterThanOrEqual(line.left - 0.5);
          }
        }
      }

      // Another size: portrait fills the height instead.
      await page.locator('[data-canvas-size]').selectOption('1080x1920');
      await expect.poll(() => frameSize(page), { timeout: 30_000 }).toEqual([1080, 1920]);
      const tall = await rect(page, '[data-remote-picture]');
      expect(tall.width / tall.height).toBeCloseTo(1080 / 1920, 2);
      expect(Math.abs(tall.height - room.height)).toBeLessThan(2);

      // Cancel goes back to the dashboard.
      await page.locator('[data-editor-cancel]').click();
      await page.waitForURL((u) => u.pathname === `/d/${layout.slug}`, { timeout: 60_000 });
    } finally { await cleanup(); }
  });

  test('on a phone: the canvas takes the width, the panels are below it, and opening one leaves it be', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { layout, cleanup } = await dashboard(page);
    try {
      await openCanvas(page, layout.slug, layout.id);
      const picture = await rect(page, '[data-remote-picture]');
      const room = await rect(page, '[data-canvas-room]');
      expect(Math.abs(picture.width - room.width)).toBeLessThan(2);
      expect(picture.width / picture.height).toBeCloseTo(1920 / 1080, 2);
      const panels = await rect(page, '[data-editor-panels]');
      expect(panels.top).toBeGreaterThanOrEqual(picture.bottom);
      expect(panels.right).toBeLessThanOrEqual(390);
      for (const id of ['dashboard', 'day', 'look'] as const) {
        await page.locator(`[data-editor-open="${id}"]`).click();
        await expect(page.locator(`[data-editor-sheet="${id}"]`)).toBeVisible();
        expect(await rect(page, '[data-remote-picture]'), `the canvas with ${id} open`).toEqual(picture);
      }
    } finally { await cleanup(); }
  });

  test('"Here, full size" edits on this device from then on, and "Edit on a canvas" takes it back', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const { layout, cleanup } = await dashboard(page);
    try {
      await openCanvas(page, layout.slug, layout.id);
      await page.locator('[data-canvas-size]').selectOption('here');
      // In place: the dock-style bar over the dashboard, no frame.
      await page.waitForURL((u) => u.pathname === `/d/${layout.slug}`, { timeout: 60_000 });
      await expect(page.locator('[data-editor-bar]')).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('[data-editor-panels]')).toHaveCount(0);
      await expect(page.locator('[data-remote-frame]')).toHaveCount(0);

      await page.locator('[data-editor-open="look"]').click();
      await page.locator('[data-edit-on-canvas]').click();
      await page.waitForURL((u) => u.pathname === `/edit/${layout.id}`, { timeout: 60_000 });
      await expect(page.locator('[data-remote-picture]')).toBeVisible({ timeout: 60_000 });
    } finally { await cleanup(); }
  });
});
