import { test, expect, type Page } from '@playwright/test';
import { getSeededParentId } from './helpers/auth';

/**
 * The clock and weather line up by where their tile sits (#988): in a screen
 * corner they hug it, across and up or down; elsewhere they centre both ways;
 * a widget's Align setting overrides either axis.
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const PIN = process.env.E2E_PIN || '1234';

type Box = { left: number; right: number; top: number; bottom: number };

async function measure(page: Page, id: string) {
  return page.evaluate((wid) => {
    const cell = document.querySelector(`.widget-cell[data-widget="${wid}"]`) as HTMLElement;
    const content = (wid === 'clock' ? cell.querySelector('[data-clock-face] time:last-of-type, [data-clock-face] > *:last-child') : cell.querySelector('[data-weather-current]')) as HTMLElement;
    // The text itself, not its full-width box.
    const r = document.createRange(); r.selectNodeContents(content);
    const t = r.getBoundingClientRect(), c = cell.getBoundingClientRect();
    const box = (x: DOMRect) => ({ left: x.left, right: x.right, top: x.top, bottom: x.bottom });
    return { cell: box(c), text: box(t), x: cell.dataset.alignX, y: cell.dataset.alignY };
  }, id);
}
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

test.describe('clock and weather alignment', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database');
  test.setTimeout(90_000);

  test('a corner tile hugs its corner, a middle tile centres, and Align wins', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
    const widgets = [
      { i: 'clock', x: 0, y: 0, w: 12, h: 8, visible: true },
      { i: 'weather', x: 18, y: 10, w: 12, h: 8, visible: true },
      { i: 'messages', x: 36, y: 19, w: 12, h: 8, visible: true },
    ];
    const layout = await (await page.request.post('/api/layouts', { data: { name: `Align ${Date.now()}`, widgets } })).json();
    try {
      await page.goto(`/d/${layout.slug}`);
      await page.locator('.widget-cell[data-widget="clock"] [data-clock-face]').waitFor({ timeout: 60_000 });
      await page.waitForTimeout(1500);

      const clock = await measure(page, 'clock');
      expect([clock.x, clock.y]).toEqual(['left', 'top']);
      const cw = clock.cell.right - clock.cell.left, ch = clock.cell.bottom - clock.cell.top;
      expect(clock.text.left - clock.cell.left, 'hugs the left').toBeLessThan(cw * 0.2);
      expect(clock.text.top - clock.cell.top, 'hugs the top').toBeLessThan(ch * 0.35);

      const weather = await measure(page, 'weather');
      expect([weather.x, weather.y]).toEqual(['center', 'middle']);
      const mid = (b: Box) => (b.left + b.right) / 2;
      expect(near(mid(weather.text), mid(weather.cell), (weather.cell.right - weather.cell.left) * 0.15), 'centred across').toBe(true);

      // Align overrides the corner: right and bottom.
      const set = widgets.map((w) => (w.i === 'clock' ? { ...w, settings: { align: { x: 'right', y: 'bottom' } } } : w));
      await page.request.patch(`/api/layouts/${layout.id}`, { data: { widgets: set } });
      await page.reload();
      await page.locator('.widget-cell[data-widget="clock"][data-align-x="right"]').waitFor({ timeout: 60_000 });
      await page.waitForTimeout(1000);
      const moved = await measure(page, 'clock');
      expect([moved.x, moved.y]).toEqual(['right', 'bottom']);
      expect(moved.cell.right - moved.text.right, 'hugs the right').toBeLessThan(cw * 0.2);
      expect(moved.cell.bottom - moved.text.bottom, 'sits at the bottom').toBeLessThan(ch * 0.35);
    } finally {
      await page.request.delete(`/api/layouts/${layout.id}`);
    }
  });
});
