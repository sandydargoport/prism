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

/**
 * The editor's tabs (#1326, #1349): each label on one line, and how far the row
 * runs past its width (it scrolls sideways where they do not all fit).
 */
async function tabRow(page: Page) {
  return page.locator('[data-editor-tabs]').evaluate((nav) => ({
    overflow: nav.scrollWidth - nav.clientWidth,
    wrapped: [...nav.querySelectorAll('[data-editor-open]')].filter((b) => {
      const label = b.querySelector('span:not([aria-label])')!;
      return label.getBoundingClientRect().height > parseFloat(getComputedStyle(label).lineHeight) + 1;
    }).map((b) => b.getAttribute('data-editor-open')),
  }));
}

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
      // Every tab on one line, and all in view (#1326).
      expect(await tabRow(page)).toEqual({ overflow: 0, wrapped: [] });

      // Opening each panel leaves the canvas exactly where it was.
      for (const id of ['screen', 'dashboard', 'widgets', 'look', 'more'] as const) {
        await page.locator(`[data-editor-open="${id}"]`).click();
        const sheet = page.locator(`[data-editor-sheet="${id}"]`);
        await expect(sheet).toBeVisible();
        expect(await rect(page, '[data-remote-picture]'), `the canvas with ${id} open`).toEqual(picture);
        const s = await rect(page, `[data-editor-sheet="${id}"]`);
        expect(s.left, `${id} is beside the canvas`).toBeGreaterThanOrEqual(picture.right);
        expect(s.bottom, `${id} ends inside the window`).toBeLessThanOrEqual(900 + 0.5);
        if (id === 'screen') {
          // A device nobody named (#1349): its idle rows work, inside the
          // panel, and it has no times until it is named; Add a time asks.
          expect(await sheet.evaluate((el) => el.scrollWidth - el.clientWidth), 'nothing runs past the panel').toBeLessThanOrEqual(0);
          await expect(sheet.locator('[data-screen-scope]')).toHaveText('Not named yet · This screen');
          await expect(sheet.getByLabel('Idle after')).toBeVisible();
          await expect(sheet.getByLabel('By day it shows')).toBeVisible();
          await expect(sheet.getByLabel('At night it shows')).toBeVisible();
          await expect(sheet.locator('[data-switch-row]')).toHaveCount(0);
          await sheet.locator('[data-switch-add="times"]').click();
          await expect(sheet.locator('[data-name-first] [data-name-device-form]')).toBeVisible();
          await expect(sheet.locator('[data-switch-row]')).toHaveCount(0);
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
      // No tab label wraps; a row too narrow for them all scrolls instead (#1326).
      expect((await tabRow(page)).wrapped).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 'the page itself does not scroll sideways').toBeLessThanOrEqual(0);
      for (const id of ['screen', 'dashboard', 'look'] as const) {
        await page.locator(`[data-editor-open="${id}"]`).click();
        await expect(page.locator(`[data-editor-sheet="${id}"]`)).toBeVisible();
        expect(await rect(page, '[data-remote-picture]'), `the canvas with ${id} open`).toEqual(picture);
      }
    } finally { await cleanup(); }
  });

  /** The smallest words in each, and the shortest control in a widget's settings against Cancel's height. */
  const panelSizes = (page: Page) => page.evaluate(() => {
    const minFont = (root: Element | null) => {
      let min = Infinity;
      if (!root) return min;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement;
        if (!el || !n.textContent?.trim() || el.getBoundingClientRect().width === 0) continue;
        min = Math.min(min, parseFloat(getComputedStyle(el).fontSize));
      }
      return min;
    };
    const buttons = [...document.querySelectorAll('[data-widget-settings] button')].map((b) => b.getBoundingClientRect().height);
    return {
      settingsText: minFont(document.querySelector('[data-widget-settings]')),
      tabsText: minFont(document.querySelector('[data-editor-panels] nav')),
      shortestControl: Math.min(...buttons),
      shortestHide: Math.min(...[...document.querySelectorAll('[data-widget-hide]')].map((b) => Math.min(b.getBoundingClientRect().height, b.getBoundingClientRect().width))),
      cancel: document.querySelector('[data-editor-cancel]')!.getBoundingClientRect().height,
      pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });

  test("on a laptop: a selected widget's settings are in the Widgets panel at its size, and the canvas shows only the screen (#1323)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const { layout, cleanup } = await dashboard(page);
    try {
      await openCanvas(page, layout.slug, layout.id);
      const frame = page.frameLocator('[data-remote-frame]');
      const picture = await rect(page, '[data-remote-picture]');
      const tasksAt = () => frame.locator('[data-editor-widget="tasks"]').evaluate((el) => el.getBoundingClientRect().toJSON() as Rect);
      const before = await tasksAt();
      await expect(page.locator('[data-editor-sheet="widgets"] [data-widget-settings-hint]')).toBeVisible();

      // With Look open, selecting the clock brings Widgets forward, with its settings.
      await page.locator('[data-editor-open="look"]').click();
      await frame.locator('[data-editor-widget="clock"]').click();
      const settings = page.locator('[data-editor-sheet="widgets"] [data-widget-settings="clock"]');
      await expect(settings).toBeVisible();
      for (const name of ['Fill', 'Outline', 'Text', 'When it shows']) {
        await expect(settings.getByRole('heading', { name })).toBeVisible();
      }
      await expect(settings.locator('[data-align-axis="x"]')).toBeVisible();

      // Nothing is drawn over the canvas and nothing on it moved: the strip
      // the settings used to be in pushed the grid down.
      await expect(frame.locator('[data-widget-settings]')).toHaveCount(0);
      await expect(frame.getByRole('button', { name: /^Fill/ })).toHaveCount(0);
      expect(await tasksAt(), 'the widgets stay where they were').toEqual(before);
      expect(await rect(page, '[data-remote-picture]')).toEqual(picture);

      // Beside the canvas, inside the panel, at the panel's own sizes.
      expect((await rect(page, '[data-widget-settings="clock"]')).left).toBeGreaterThanOrEqual(picture.right);
      const sheet = page.locator('[data-editor-sheet="widgets"]');
      expect(await sheet.evaluate((el) => el.scrollWidth - el.clientWidth), 'nothing runs past the panel').toBeLessThanOrEqual(0);
      const sizes = await panelSizes(page);
      expect(sizes.settingsText, 'no word smaller than the panel tabs').toBeGreaterThanOrEqual(sizes.tabsText);
      expect(sizes.shortestControl, 'every control as tall as Cancel').toBeGreaterThanOrEqual(sizes.cancel - 0.5);
      expect(sizes.shortestHide, "each row's Hide is as big a target as Cancel").toBeGreaterThanOrEqual(sizes.cancel - 0.5);

      // A choice is kept on the widget; Close lets it go.
      await settings.getByLabel('Glass fill').click();
      await expect(settings.getByLabel('Glass fill')).toHaveAttribute('aria-pressed', 'true');
      await expect(settings.locator('[data-fill-name]')).toHaveText(/^Glass/);
      // The list comes first, its row for the selected widget marked; the settings are under it.
      const clockRow = page.locator('[data-editor-sheet="widgets"] [data-widget-row="clock"]');
      await expect(clockRow).toHaveAttribute('aria-selected', 'true');
      expect((await rect(page, '[data-widget-settings="clock"]')).top).toBeGreaterThanOrEqual((await rect(page, '[data-widget-row="clock"]')).bottom);
      await settings.getByRole('button', { name: "Close Clock's settings" }).click();
      await expect(page.locator('[data-widget-settings]')).toHaveCount(0);
      await expect(page.locator('[data-widget-settings-hint]')).toHaveText('Pick a widget above to change its fill, outline and text.');
      await expect(frame.locator('[data-editor-widget="clock"]')).not.toHaveClass(/ring-blue-500/);

      // A tap on a row in the list selects that widget, on the canvas too.
      await page.locator('[data-widget-row="tasks"]').getByRole('button', { name: 'Tasks' }).click();
      await expect(page.locator('[data-widget-row="tasks"]')).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('[data-editor-sheet="widgets"] [data-widget-settings="tasks"]')).toBeVisible();
      await expect(frame.locator('[data-editor-widget="tasks"]')).toHaveClass(/ring-blue-500/);
    } finally { await cleanup(); }
  });

  test("on a phone: a selected widget's settings are in the panel below the canvas (#1323)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { layout, cleanup } = await dashboard(page);
    try {
      await openCanvas(page, layout.slug, layout.id);
      const frame = page.frameLocator('[data-remote-frame]');
      const picture = await rect(page, '[data-remote-picture]');
      await page.locator('[data-editor-open="look"]').click();
      await frame.locator('[data-editor-widget="clock"]').click();
      await expect(page.locator('[data-editor-sheet="widgets"] [data-widget-settings="clock"]')).toBeVisible();
      expect(await rect(page, '[data-remote-picture]'), 'the canvas stays put').toEqual(picture);
      const s = await rect(page, '[data-widget-settings="clock"]');
      expect(s.top).toBeGreaterThanOrEqual(picture.bottom);
      expect(s.right).toBeLessThanOrEqual(390);
      const sheet = page.locator('[data-editor-sheet="widgets"]');
      expect(await sheet.evaluate((el) => el.scrollWidth - el.clientWidth), 'nothing runs past the panel').toBeLessThanOrEqual(0);
      const sizes = await panelSizes(page);
      expect(sizes.pageOverflow, 'no sideways scroll').toBeLessThanOrEqual(0);
      expect(sizes.settingsText).toBeGreaterThanOrEqual(sizes.tabsText);
      expect(sizes.shortestControl).toBeGreaterThanOrEqual(sizes.cancel - 0.5);
      expect(sizes.shortestHide, "each row's Hide is as big a target as Cancel").toBeGreaterThanOrEqual(sizes.cancel - 0.5);
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
      // The screen's own options are under Screen > Advanced (#1349).
      await page.locator('[data-editor-open="screen"]').click();
      await page.locator('[data-editor-sheet="screen"]').getByRole('button', { name: /^Advanced: orientation/ }).click();
      await page.locator('[data-editor-sheet="screen"]').getByLabel('Performance').selectOption(choice);
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
