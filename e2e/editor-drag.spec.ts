import { test, expect, type FrameLocator, type Page } from '@playwright/test';
import { getSeededParentId } from './helpers/auth';
import { editOnCanvas } from './helpers/canvasEditor';

/**
 * #1265: dragging in the editor. Every card's blur is drawn again on every
 * frame while a widget moves behind or over it, which was most of a drag's
 * compositing work, so the editor drops the blur while something moves and
 * puts it back on the drop. Measured on the canvas, where every device
 * edits (#1283).
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const PIN = process.env.E2E_PIN || '1234';

async function editLayout(page: Page): Promise<{ frame: FrameLocator; cleanup: () => Promise<unknown> }> {
  await page.setViewportSize({ width: 1440, height: 900 });
  expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
  const res = await page.request.post('/api/layouts', { data: { name: `Drag ${Date.now()}`, view: 'grid', widgets: [
    { i: 'clock', x: 0, y: 0, w: 4, h: 4 },
    { i: 'tasks', x: 6, y: 0, w: 6, h: 6 },
  ] } });
  expect(res.ok()).toBe(true);
  const layout = await res.json();
  const frame = await editOnCanvas(page, layout.slug, 'clock');
  return { frame, cleanup: () => page.request.delete(`/api/layouts/${layout.id}`) };
}

/** The backdrop-filter on the card of a widget (the element that carries the blur class). */
const blurOf = (frame: FrameLocator, id: string) => frame.locator(`[data-editor-widget="${id}"] [class*="backdrop-blur"]`).first()
  .evaluate((e) => getComputedStyle(e).backdropFilter);

test.describe('editor drag (#1265)', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database');
  test.setTimeout(150_000);

  test('the cards drop their blur while a widget is dragged, and get it back on the drop', async ({ page }) => {
    const { frame, cleanup } = await editLayout(page);
    try {
      expect(await blurOf(frame, 'tasks')).toMatch(/blur/);

      // One click selects the widget in move mode; only then does it drag.
      const clock = frame.locator('[data-editor-widget="clock"]');
      await clock.click();
      await expect(clock).toHaveClass(/ring-blue-500/);
      const box = (await clock.boundingBox())!;
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 60, y + 30, { steps: 10 });

      // Mid-drag: the other card, under the moving one, has no blur.
      await expect.poll(() => blurOf(frame, 'tasks')).toBe('none');

      await page.mouse.move(x, y, { steps: 10 });
      await page.mouse.up();
      await expect.poll(() => blurOf(frame, 'tasks')).toMatch(/blur/);
    } finally { await cleanup(); }
  });

  // #1338: every edit happens on this canvas, so a dashed frame round every
  // widget made the dashboard look outlined the whole time it was edited.
  test('a widget has a dashed frame only while it is pointed at or selected (#1338)', async ({ page }) => {
    const { frame, cleanup } = await editLayout(page);
    try {
      const frameStyle = (id: string) => frame.locator(`[data-editor-widget="${id}"] > [data-editor-frame]`)
        .evaluate((e) => getComputedStyle(e).borderTopStyle);
      // Nothing pointed at, nothing selected: no frame on either.
      await page.mouse.move(1, 1);
      await expect.poll(() => frameStyle('tasks')).toBe('none');
      await expect.poll(() => frameStyle('clock')).toBe('none');

      // Pointing at one frames that one only.
      await frame.locator('[data-editor-widget="tasks"]').hover();
      await expect.poll(() => frameStyle('tasks')).toBe('dashed');
      expect(await frameStyle('clock')).toBe('none');

      // Selected keeps its frame with the pointer gone; the other loses it.
      const clock = frame.locator('[data-editor-widget="clock"]');
      await clock.click();
      await expect(clock).toHaveClass(/ring-blue-500/);
      await page.mouse.move(1, 1);
      await expect.poll(() => frameStyle('clock')).toBe('dashed');
      await expect.poll(() => frameStyle('tasks')).toBe('none');
    } finally { await cleanup(); }
  });
});
