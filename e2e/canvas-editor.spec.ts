import { test, expect, type Page } from '@playwright/test';
import { getSeededParentId } from './helpers/auth';

/**
 * #1265, #1280: one editor everywhere. Every device edits a dashboard on a
 * canvas: the dashboard laid out at a screen's size, scaled to fit, with the
 * panels beside it on a laptop and below it on a phone. A named screen opens
 * its own editor. These measure the canvas.
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const PIN = process.env.E2E_PIN || '1234';

type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
const rect = (page: Page, sel: string) =>
  page.locator(sel).first().evaluate((el) => el.getBoundingClientRect().toJSON() as Rect);

async function dashboard(page: Page, widgets = [
  { i: 'clock', x: 0, y: 0, w: 16, h: 12 },
  { i: 'tasks', x: 16, y: 0, w: 16, h: 24 },
]) {
  expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
  const res = await page.request.post('/api/layouts', { data: { name: `Canvas ${Date.now()}`, view: 'grid', widgets } });
  expect(res.ok()).toBe(true);
  const layout = await res.json() as { id: string; slug: string };
  return { layout, cleanup: () => page.request.delete(`/api/layouts/${layout.id}`) };
}

/** Opens the dashboard's editor link and waits for the canvas and its panels. */
async function openCanvas(page: Page, slug: string, id: string, widget = 'clock') {
  await page.goto(`/d/${slug}?edit=1`);
  // Not a named screen: the link goes to the canvas editor in its place.
  await page.waitForURL((u) => u.pathname === `/edit/${id}`, { timeout: 60_000 });
  const frame = page.frameLocator('[data-remote-frame]');
  await expect(frame.locator(`[data-editor-widget="${widget}"]`)).toBeVisible({ timeout: 90_000 });
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
          // Its rows stay inside the panel (#1281), and a dashboard edited
          // on its own has no screen to rest or dim, so only its own look shows.
          expect(await sheet.evaluate((el) => el.scrollWidth - el.clientWidth), 'nothing runs past the panel').toBeLessThanOrEqual(0);
          await expect(sheet.getByLabel('While resting')).toBeVisible();
          // Night folds to one line (#1294), and opens to its look.
          await sheet.locator('[data-night-row] [data-fold-toggle]').click();
          await expect(sheet.getByLabel('Night look')).toBeVisible();
          await expect(sheet.getByLabel('Rest after')).toHaveCount(0);
          await expect(sheet.getByLabel('How dark at night')).toHaveCount(0);
          await expect(sheet.locator('[data-timeline-bar]')).toHaveCount(0);
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

  test('another dashboard picked on Dashboard opens there, still on Dashboard (#1278)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const first = await dashboard(page);
    const second = await dashboard(page, [{ i: 'weather', x: 0, y: 0, w: 16, h: 12 }]);
    try {
      await openCanvas(page, first.layout.slug, first.layout.id);
      await page.locator('[data-editor-open="dashboard"]').click();
      await page.locator(`[data-dashboard-row="${second.layout.id}"]`).click();

      // The second is in the frame, being edited, with Dashboard open on it.
      const frame = page.frameLocator('[data-remote-frame]');
      await expect(frame.locator('[data-editor-widget="weather"]')).toBeVisible({ timeout: 90_000 });
      const panel = page.locator('[data-editor-sheet]');
      const row = page.locator(`[data-dashboard-row="${second.layout.id}"]`);
      await expect(row).toHaveAttribute('aria-current', 'true', { timeout: 15_000 });
      await expect(panel).toHaveAttribute('data-editor-sheet', 'dashboard');
      // And it stays there once the dashboard has loaded.
      await page.waitForTimeout(2_000);
      await expect(panel).toHaveAttribute('data-editor-sheet', 'dashboard');
      await expect(row).toHaveAttribute('aria-current', 'true');

      // Opened afresh, an editor starts on Widgets as ever.
      await openCanvas(page, second.layout.slug, second.layout.id, 'weather');
    } finally { await first.cleanup(); await second.cleanup(); }
  });

  test('a named screen edits itself on its own canvas, and Done brings its settings home (#1280)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const { layout, cleanup } = await dashboard(page);
    // This browser is a named screen.
    const named = await page.request.post('/api/displays', { data: { name: `Hall ${Date.now()}` } });
    expect(named.ok()).toBe(true);
    const { display } = await named.json() as { display: { id: string; name: string } };
    try {
      await page.goto(`/d/${layout.slug}`);
      await expect.poll(
        () => page.evaluate(() => JSON.parse(localStorage.getItem('prism:display-sync-base') ?? 'null')?.displayId ?? null),
        { timeout: 60_000 },
      ).toBe(display.id);
      const before = await page.evaluate(() => localStorage.getItem('prism-perf-mode'));

      // Edit opens its own editor on the canvas, on the dashboard it was showing.
      await page.goto(`/d/${layout.slug}?edit=1`);
      await page.waitForURL((u) => u.pathname === `/screens/${display.id}`, { timeout: 60_000 });
      await expect(page.locator('h1')).toHaveText(`Editing ${display.name}`);
      const frame = page.frameLocator('[data-remote-frame]');
      await expect(frame.locator('[data-editor-widget="clock"]')).toBeVisible({ timeout: 90_000 });
      await expect(page.locator('[data-remote-edit-root] [data-editor-panels]')).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('[data-editor-bar]:not([data-editor-panels])')).toHaveCount(0);

      // It is not told it is being edited from elsewhere, and is not reloaded
      // under the editing: still the same page after a beat.
      await page.evaluate(() => { (window as unknown as { stillHere: boolean }).stillHere = true; });
      await page.waitForTimeout(7_000);
      await expect(page.locator('[data-remote-editing-note]')).toHaveCount(0);
      expect(await page.evaluate(() => (window as unknown as { stillHere?: boolean }).stillHere)).toBe(true);

      // One of its own settings, then Done: back on its dashboard, with it.
      const choice = before === 'minimal' ? 'reduced' : 'minimal';
      await page.locator('[data-editor-open="look"]').click();
      await page.locator('[data-editor-sheet="look"]').getByLabel('Performance').selectOption(choice);
      await page.locator('[data-editor-done]').click();
      // Back showing dashboards (a switch of its own may move it on from this one).
      await page.waitForURL((u) => u.pathname === '/' || u.pathname.startsWith('/d/'), { timeout: 60_000 });
      await expect(page.locator('[data-remote-frame]')).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => localStorage.getItem('prism-perf-mode')), { timeout: 30_000 }).toBe(choice);
      expect((await (await page.request.get('/api/displays')).json()).displays
        .find((d: { id: string }) => d.id === display.id)?.settings?.['prism-perf-mode']).toBe(choice);

      // Its row in Settings > Screens opens the same editor.
      await page.request.post('/api/auth/verify-pin', { data: { userId: getSeededParentId(), pin: PIN } });
      await page.goto('/settings?section=displays');
      const row = page.getByTestId('display-row').filter({ hasText: display.name });
      await row.getByRole('link', { name: 'Edit' }).click();
      await page.waitForURL((u) => u.pathname === `/screens/${display.id}`, { timeout: 60_000 });
    } finally {
      await page.request.delete(`/api/displays/${display.id}`);
      await cleanup();
    }
  });
});
