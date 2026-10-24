import { test, expect, type Page } from '@playwright/test';
import { getSeededParentId } from './helpers/auth';

/**
 * A widget sized in the screensaver editor lands at the same size and place in
 * the live screensaver (#689).
 *
 * The editor draws a Screen frame and square cells; the live screensaver
 * scales a canvas to fit the real screen. They agree only if that canvas IS
 * the frame. It used to be the widgets' own bounding box, so a layout that
 * stopped short of the frame's edge was scaled up and every widget rendered
 * taller and lower than sized. Unit tests cannot see this: both sides compute
 * plausible numbers, and only the rendered boxes disagree.
 *
 * Editing needs a parent login, so this runs only against the seeded test
 * database (see calendar-geometry.spec.ts for why the PIN is gated).
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const PIN = process.env.E2E_PIN || '1234';

/** Inside both default frames (48x27 landscape, 36x64 portrait) and short of
 *  their right and bottom edges, which is what the old fit got wrong. */
const LAYOUT = [
  { i: 'clock', x: 2, y: 2, w: 16, h: 10, visible: true },
  { i: 'weather', x: 20, y: 14, w: 14, h: 8, visible: true },
  { i: 'messages', x: 32, y: 16, w: 16, h: 12, visible: false },
];

type Box = { x: number; y: number; w: number; h: number };

async function boxes(page: Page, selector: string): Promise<Record<string, Box>> {
  return page.evaluate((sel) => {
    const out: Record<string, { x: number; y: number; w: number; h: number }> = {};
    document.querySelectorAll(sel).forEach((el) => {
      const id = el.getAttribute('data-editor-widget') || el.getAttribute('data-widget');
      const b = el.getBoundingClientRect();
      if (id) out[id] = { x: b.x, y: b.y, w: b.width, h: b.height };
    });
    return out;
  }, selector);
}

async function openScreensaverEditor(page: Page, orientation: 'landscape' | 'portrait') {
  const login = await page.request.post('/api/auth/login', {
    data: { userId: getSeededParentId(), pin: PIN },
  });
  expect(login.ok(), 'precondition: login must succeed before measuring').toBe(true);
  await page.addInitScript((layout) => {
    // Once per test: the editor writes this key itself after load.
    if (sessionStorage.getItem('ss-geometry-seeded')) return;
    localStorage.setItem('prism-screensaver-layout', JSON.stringify(layout));
    sessionStorage.setItem('ss-geometry-seeded', '1');
  }, LAYOUT);
  await page.goto('/');
  await page.getByLabel('Edit layout').click({ timeout: 60000 });
  await page.getByRole('button', { name: 'Screensaver', exact: true }).click();
  // The guide orientation is saved on the dashboard, so another test may have
  // left it either way.
  const toggle = page.getByRole('button', { name: /Landscape|Portrait/ });
  if (!(await toggle.textContent())?.toLowerCase().includes(orientation)) await toggle.click();
  await expect(toggle).toContainText(orientation === 'landscape' ? 'Landscape' : 'Portrait');
  await page.locator('[data-editor-widget="clock"]').waitFor();
  await page.waitForTimeout(800);
}

for (const [orientation, viewport] of [
  ['landscape', { width: 1280, height: 720 }],
  ['portrait', { width: 900, height: 1600 }],
] as const) {
  test.describe(`screensaver geometry, ${orientation}`, () => {
    test.skip(!HAS_TEST_DB, 'needs the seeded test database to log in and edit');
    test.use({ viewport });
    // The first test in the CI step waits for the dev server to compile the
    // dashboard and the editor's chunks from cold, which alone ran past the
    // 30 s default. A warm run takes about 7 s.
    test.setTimeout(90_000);

    test('a widget renders where and as big as it was sized in the editor', async ({ page }) => {
      await openScreensaverEditor(page, orientation);

      const edited = await boxes(page, '[data-editor-widget]');
      const frame = await page.evaluate(() => {
        const label = [...document.querySelectorAll('span')].find((s) => s.textContent === 'Screen');
        const b = label?.parentElement?.getBoundingClientRect();
        return b ? { x: b.x, y: b.y, w: b.width, h: b.height } : null;
      });
      expect(frame, 'the editor draws a Screen frame').not.toBeNull();

      // Preview claims to show the screen as the screensaver will draw it.
      await page.getByRole('button', { name: 'Preview', exact: true }).click();
      await page.waitForTimeout(800);
      const previewed = await boxes(page, '.widget-cell[data-widget]');
      await page.keyboard.press('Control+Shift+M');

      await page.evaluate(() => window.dispatchEvent(new Event('prism:screensaver')));
      const liveCell = page.locator('.fixed.inset-0 .widget-cell[data-widget="clock"]');
      await liveCell.waitFor();
      await page.waitForTimeout(1500);
      const live = await boxes(page, '.fixed.inset-0 .widget-cell[data-widget]');
      // The live frame is the grid's content box: the canvas inside its padding.
      const liveFrame = await liveCell.evaluate((el) => {
        const grid = el.parentElement!;
        const b = grid.getBoundingClientRect();
        const cs = getComputedStyle(grid);
        const t = parseFloat(cs.paddingTop), r = parseFloat(cs.paddingRight);
        const bt = parseFloat(cs.paddingBottom), l = parseFloat(cs.paddingLeft);
        return { x: b.x + l, y: b.y + t, w: b.width - l - r, h: b.height - t - bt };
      });

      const sx = liveFrame.w / frame!.w;
      const sy = liveFrame.h / frame!.h;
      for (const { i } of LAYOUT.filter((w) => w.visible)) {
        const e = edited[i], l = live[i], p = previewed[i];
        expect(e && l && p, `${i} is drawn in the editor, Preview and live`).toBeTruthy();
        if (!e || !l || !p) return;
        // Same place and size relative to the Screen frame.
        const expected = {
          x: liveFrame.x + (e.x - frame!.x) * sx,
          y: liveFrame.y + (e.y - frame!.y) * sy,
          w: e.w * sx,
          h: e.h * sy,
        };
        for (const k of ['y', 'h', 'x', 'w'] as const) {
          expect(Math.abs(l[k] - expected[k]), `${i} ${k}: live ${l[k]} vs sized ${expected[k]}`).toBeLessThanOrEqual(1);
          expect(Math.abs(p[k] - l[k]), `${i} ${k}: Preview ${p[k]} vs live ${l[k]}`).toBeLessThanOrEqual(1);
        }
      }
    });
  });
}
