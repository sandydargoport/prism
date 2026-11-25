import { test, expect, type FrameLocator, type Page } from '@playwright/test';
import { canvasShows, onCanvas } from './helpers/canvasEditor';
import { getFirstParent, getSeededParentId, verifySettingsPinViaAPI } from './helpers/auth';
import {
  facingFor, localSiderealTime, moonPosition, project, toHorizontal,
} from '../src/components/screensaver/nightSky/sky';
import { FIGURES } from '../src/components/screensaver/nightSky/catalog';
import type { IdleBackground } from '../src/lib/idleBackground';
import { waitForQuiet } from './helpers/network';
import { FIRST_SCREEN_TEMPLATE } from '../src/lib/constants/layoutTemplates';

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

/**
 * Open the layout editor on the dashboard this page shows, by its edit link
 * (`?edit=1`), as Edit does: on the canvas (#1283), the dashboard in a frame
 * at a screen's size, the panels beside it, one of them always open. The
 * dock's way there (Menu, More, Edit layout) is dock.spec.ts's. Returns the frame.
 */
async function openEditor(page: Page, widget?: string): Promise<FrameLocator> {
  await page.goto(`${new URL(page.url()).pathname}?edit=1`);
  return onCanvas(page, widget);
}

/** The editor's panels (#1151), by their tabs. */
async function openSheet(page: Page, id: 'screen' | 'widgets' | 'look') {
  await page.locator(`[data-editor-open="${id}"]`).click();
  await expect(page.locator(`[data-editor-sheet="${id}"]`)).toBeVisible();
}
const done = (page: Page) => page.locator('[data-editor-done]');
/** A plain weather answer, for when the weather service refuses (a daily limit, say). */
const STAND_IN_WEATHER = {
  location: 'Springfield',
  current: { temperature: 60, feelsLike: 59, condition: 'clear', humidity: 50, windSpeed: 5, description: 'Clear' },
  forecast: [],
  hourly: [],
  units: { temperature: 'F', windSpeed: 'mph', precipitation: 'in' },
  lastUpdated: '2026-06-21T12:00:00Z',
};

/**
 * Weather at a made-up place, so the sky is drawn where these tests look for
 * it. The real answer is kept when the weather service gives one; when it
 * refuses, a plain one stands in, or the sky would fall back to a place
 * guessed from the time zone.
 */
async function weatherAt(page: Page, place: Record<string, unknown>) {
  await page.route('**/api/weather*', async (route) => {
    const response = await route.fetch().catch(() => null);
    const real = response?.ok() ? await response.json() as Record<string, unknown> : STAND_IN_WEATHER;
    return route.fulfill({ json: { ...real, ...place } });
  });
}

/** Done on the canvas goes back to the dashboard. */
const backOn = (page: Page, slug: string) => page.waitForURL((u) => u.pathname === `/d/${slug}`, { timeout: 60_000 });

/**
 * Names this browser as a screen showing `dashboardId`, for the settings that
 * are a screen's own (Idle after, Darker at night), and opens that screen's editor
 * on the dashboard (#1283). Returns the frame and a remover for the screen.
 */
async function editAsScreen(page: Page, dashboardId: string): Promise<{ frame: FrameLocator; removeScreen: () => Promise<unknown> }> {
  await verifySettingsPinViaAPI(page, (await getFirstParent(page)).name, PIN);
  const named = await page.request.post('/api/displays', { data: { name: `Screensaver e2e ${Date.now()}` } });
  expect(named.ok(), 'precondition: this browser is named').toBe(true);
  const id: string = (await named.json()).display?.id ?? (await (await page.request.get('/api/displays')).json()).currentId;
  // The day this browser was seeded with, as its first sync would carry it up (#1345).
  const day = seededDays.get(page);
  expect((await page.request.patch(`/api/displays/${id}`, {
    data: { dashboardId, ...(day ? { settings: { 'prism-screen-day': day } } : {}) },
  })).ok()).toBe(true);
  await page.goto(`/screens/${id}?dashboard=${dashboardId}`);
  const frame = await onCanvas(page);
  return { frame, removeScreen: () => page.request.delete(`/api/displays/${id}`) };
}

const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';

// A browser that has not run since v1.30.1 carries the arrangement it kept
// onto the dashboard it shows (#1154), which would then stay on the shared
// seeded dashboard for every later test. Each browser here has already run,
// except in the upgrade test.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('prism-screensaver-carried', '1'));
});
const PIN = process.env.E2E_PIN || '1234';

/**
 * Every dashboard comes with this photo frame arrangement, as the server
 * would send it once saved there: the photo frame reads it from the
 * dashboard, never from the browser (#1346). Only the reads are answered so,
 * so nothing is saved onto the shared seeded dashboard. Calling it again
 * replaces the arrangement.
 */
const LAYOUTS_URL = /\/api\/layouts(\?.*)?$/;
async function arrangedAs(page: Page, widgets: unknown[]) {
  await page.unroute(LAYOUTS_URL);
  await page.route(LAYOUTS_URL, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const response = await route.fetch();
    const body = await response.json() as { layouts?: Record<string, unknown>[] };
    body.layouts = (body.layouts ?? []).map((l) => ({ ...l, screensaverWidgets: widgets }));
    return route.fulfill({ response, json: body });
  });
}

/**
 * This browser's screen idles so (#1345): its day is a screen setting, not
 * the dashboard's, written once per tab so a day the editor saves survives a
 * reload. A screen named in the test carries it up on its first sync.
 */
async function screenIdles(page: Page, bg: IdleBackground, nightLevel: 0 | 25 | 50 | 75 = 0) {
  const pair = 'source' in bg
    ? { day: bg.source, night: bg.source, switch: { by: 'sun', duskOffset: 30, dawnOffset: -30 } }
    : bg;
  const day = JSON.stringify({ ...pair, nightLevel });
  seededDays.set(page, day);
  await page.addInitScript((value) => {
    if (sessionStorage.getItem('e2e-day-seeded')) return;
    localStorage.setItem('prism-screen-day', value);
    sessionStorage.setItem('e2e-day-seeded', '1');
  }, day);
}
const seededDays = new WeakMap<Page, string>();

/** The day this browser's screen keeps, as stored. */
async function storedDay(page: Page): Promise<unknown> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('prism-screen-day') ?? 'null'));
}

/** Inside both default frames (48x27 landscape, 36x64 portrait) and short of
 *  their right and bottom edges, which is what the old fit got wrong. */
const LAYOUT = [
  { i: 'clock', x: 2, y: 2, w: 16, h: 10, visible: true },
  { i: 'weather', x: 20, y: 14, w: 14, h: 8, visible: true },
  { i: 'messages', x: 32, y: 16, w: 16, h: 12, visible: false },
];

type Box = { x: number; y: number; w: number; h: number };

/** Each widget's box, in the page's or a frame's own coordinates. */
async function boxes(where: Page | FrameLocator, selector: string): Promise<Record<string, Box>> {
  return where.locator('body').evaluate((_, sel) => {
    const out: Record<string, { x: number; y: number; w: number; h: number }> = {};
    document.querySelectorAll(sel).forEach((el) => {
      const id = el.getAttribute('data-editor-widget') || el.getAttribute('data-widget');
      const b = el.getBoundingClientRect();
      if (id) out[id] = { x: b.x, y: b.y, w: b.width, h: b.height };
    });
    return out;
  }, selector);
}

/** The canvas size each orientation is edited at: the screen's own size. */
const CANVAS = {
  landscape: { width: 1920, height: 1080 },
  portrait: { width: 800, height: 1280 },
} as const;

async function openScreensaverEditor(page: Page, orientation: 'landscape' | 'portrait', outlines?: 'off') {
  const login = await page.request.post('/api/auth/login', {
    data: { userId: getSeededParentId(), pin: PIN },
  });
  expect(login.ok(), 'precondition: login must succeed before measuring').toBe(true);
  await arrangedAs(page, LAYOUT);
  await page.addInitScript(({ outlines }) => {
    if (sessionStorage.getItem('ss-geometry-seeded')) return;
    // Drift is on by default and would move the live widgets off their places.
    localStorage.setItem('prism-screensaver-drift', 'off');
    if (outlines) localStorage.setItem('prism-screensaver-outlines', outlines);
    sessionStorage.setItem('ss-geometry-seeded', '1');
  }, { outlines });
  // The guide orientation is saved on the dashboard, so another test may have
  // left it either way. Its control is gone (#1350): set it as saved.
  const all = (await (await page.request.get('/api/layouts')).json()).layouts as Array<{ id: string; isDefault: boolean }>;
  const home = all.find((l) => l.isDefault);
  if (home) expect((await page.request.patch(`/api/layouts/${home.id}`, { data: { orientation } })).ok()).toBe(true);
  await page.goto('/');
  const frame = await openEditor(page, 'clock');
  // The canvas is the screen: its size and shape for this orientation, the
  // portrait one near the size this measured at before (#1283).
  const { width, height } = CANVAS[orientation];
  await page.locator('[data-canvas-size]').selectOption(`${width}x${height}`);
  await frame.locator('[data-editor-widget="clock"]').waitFor({ timeout: 90_000 });
  // The seeded dashboard shows the screensaver over photos, so the idle
  // screen (Idle over the canvas, #1348) arranges its layout, whichever
  // panel is open.
  await canvasShows(page, 'idle', 'day');
  await openSheet(page, 'look');
  await expect(page.locator('[data-canvas-pick="idle"]')).toHaveAttribute('aria-pressed', 'true');
  await frame.locator('[data-editor-widget="clock"]').waitFor();
  await page.waitForTimeout(800);
  return frame;
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
    test.setTimeout(180_000);

    test('a widget renders where and as big as it was sized in the editor', async ({ page }) => {
      // All three are measured in the canvas's frame, which is the screen (#1283).
      const canvas = await openScreensaverEditor(page, orientation);

      const edited = await boxes(canvas, '[data-editor-widget]');
      const frame = await canvas.locator('body').evaluate(() => {
        const label = [...document.querySelectorAll('span')].find((s) => s.textContent === 'Screen');
        const b = label?.parentElement?.getBoundingClientRect();
        return b ? { x: b.x, y: b.y, w: b.width, h: b.height } : null;
      });
      expect(frame, 'the editor draws a Screen frame').not.toBeNull();

      // Preview claims to show the screen as the screensaver will draw it.
      // Its shortcut, Control+Shift+M, is heard where the editor runs: the
      // frame. Once to see it at the screen's size, and again to leave.
      const preview = () => canvas.locator('body').evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'M', ctrlKey: true, shiftKey: true })));
      await preview();
      await page.waitForTimeout(800);
      const previewed = await boxes(canvas, '.widget-cell[data-widget]');
      await preview();

      // The screen never goes idle while its editor is open (#1342), so the
      // live screensaver is measured on the wall, out of the editor, at the
      // canvas's own size: the frame and this page are then the same screen.
      await page.setViewportSize(CANVAS[orientation]);
      await page.goto('/');
      await page.locator('.widget-cell[data-widget]').first().waitFor({ timeout: 60_000 });
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

    // #1338: the preview forced light outlines whatever the screen said, so
    // with Widget outlines off it showed a frame the wall never draws.
    test('with Widget outlines off the preview draws no widget outlines, as the wall does', async ({ page }) => {
      const canvas = await openScreensaverEditor(page, orientation, 'off');
      const borderColors = () => canvas.locator('body').evaluate(() =>
        [...document.querySelectorAll('[data-ss-preview-widget] [class*="bg-card"].border-border')]
          .map((e) => getComputedStyle(e).borderTopColor));
      await expect.poll(async () => (await borderColors()).length, 'a widget card is in the preview').toBeGreaterThan(0);
      for (const c of await borderColors()) expect(c).toBe('rgba(0, 0, 0, 0)');
    });
  });
}

/**
 * The night sky backdrop (#340): drawn across the whole screen in place of the
 * photos, and with "after dark" only once the sun is down where the household
 * is. The location comes from the weather response, so it is pinned here to a
 * fictional one rather than whatever the test server resolves. If the server
 * has no weather to patch, the sky falls back to a longitude from the time
 * zone; the two times below are day and night for both, so either way holds.
 */
const NOON = '2026-06-21T12:00:00Z';
const NIGHT = '2026-06-22T03:30:00Z';
/** Full dark and no moon: late evening four days after the August new moon. */
const DEEP = '2026-08-15T06:00:00Z';

const BACKGROUNDS = {
  sky: { source: 'sky' },
  photos: { source: 'photos' },
  dayNight: { day: 'photos', night: 'sky', switch: { by: 'sun', duskOffset: 0, dawnOffset: 0 } },
} satisfies Record<string, IdleBackground>;

function idleLayout(idleBackground: IdleBackground) {
  return {
    id: '00000000-0000-4000-8000-000000000782', name: 'Idle e2e', slug: 'idle-e2e', isDefault: true,
    widgets: [{ i: 'clock', x: 0, y: 0, w: 16, h: 12 }], screensaverWidgets: null, idleBackground,
    orientation: 'landscape', fontScale: null, createdAt: NOON, updatedAt: NOON,
  };
}

test.describe('screensaver night sky', () => {
  test.use({ viewport: { width: 1280, height: 720 } });
  test.setTimeout(90_000);

  /**
   * The background is the screen's own day (#1345), seeded in the browser;
   * the page is handed one dashboard. Nothing is written to the database.
   */
  async function openDashboard(page: Page, background: IdleBackground, at: string, weather: Record<string, unknown> = {}) {
    await page.clock.setFixedTime(new Date(at));
    await weatherAt(page, { lat: 45, lon: -100, ...weather });
    await screenIdles(page, background);
    await page.route('**/api/layouts', (route) => route.request().method() === 'GET'
      ? route.fulfill({ json: { layouts: [idleLayout(background)] } })
      : route.fallback());
    await page.addInitScript(() => {
      // Auto performance can step down on a slow CI runner, and a lighter
      // level stops the twinkle and shooting stars on purpose.
      localStorage.setItem('prism-perf-mode', 'false');
    });
    await page.goto('/');
    await page.locator('.widget-cell[data-widget="clock"]').waitFor({ timeout: 60000 });
    await waitForQuiet(page);
    await page.evaluate(() => window.dispatchEvent(new Event('prism:screensaver')));
  }

  async function openScreensaver(page: Page, backdrop: keyof typeof BACKGROUNDS, at: string, weather: Record<string, unknown> = {}) {
    await openDashboard(page, BACKGROUNDS[backdrop], at, weather);
    await page.locator('.fixed.inset-0.z-9999').waitFor();
    await page.waitForTimeout(1500);
  }

  /** The sky canvas's box, and whether it has painted an opaque sky at the top. */
  async function sky(page: Page) {
    return page.evaluate(() => {
      const el = document.querySelector<HTMLCanvasElement>('[data-testid="night-sky"]');
      if (!el) return null;
      const b = el.getBoundingClientRect();
      const px = el.getContext('2d')!.getImageData(Math.floor(el.width / 2), 2, 1, 1).data;
      return { x: b.x, y: b.y, w: b.width, h: b.height, alpha: px[3] };
    });
  }

  // #929: the screensaver wears Today's materials.
  test('over photos the clock is in the display face, white by day and warm after dusk', async ({ page, context }) => {
    const ink = async () => page.locator('.fixed.inset-0.z-9999 [data-clock-time]').first().evaluate((el) => ({
      color: getComputedStyle(el).color,
      face: getComputedStyle(el).fontFamily,
    }));
    await openScreensaver(page, 'photos', NOON);
    await expect(page.locator('[data-screensaver-shade]')).toHaveCount(1);
    const day = await ink();
    expect(day.face, 'display face').toMatch(/Literata/i);
    expect(day.color).toBe('rgb(255, 255, 255)');

    const night = await context.newPage();
    await openScreensaver(night, 'photos', NIGHT);
    await expect(night.locator('[data-screensaver-night]')).toHaveCount(1);
    const warm = await night.locator('.fixed.inset-0.z-9999 [data-clock-time]').first().evaluate((el) => getComputedStyle(el).color);
    expect(warm).toBe('rgb(255, 226, 190)');
    await night.close();
  });

  // A widget's list on the resting screen scrolls with no scrollbar drawn: over
  // a photo the thin thumb read as a stray line that came and went.
  test('a list on the resting screen draws no scrollbar', async ({ page }) => {
    await openScreensaver(page, 'photos', NOON);
    const gutter = await page.locator('[data-screensaver]').first().evaluate((root) => {
      const list = document.createElement('div');
      list.style.cssText = 'overflow:auto;height:60px;width:200px';
      const tall = document.createElement('div');
      tall.style.height = '600px';
      list.append(tall);
      root.append(list);
      // Overlay scrollbars take no width, so the style is what tells.
      const style = getComputedStyle(list).scrollbarWidth;
      list.remove();
      return style;
    });
    expect(gutter, 'no scrollbar drawn on the resting screen').toBe('none');
  });

  // Widgets on the photo frame drop their backings to sit on the photo; the
  // calendar's name chips keep their colours, so each calendar reads as its own.
  test('the calendar name chips keep their colours on the photo frame', async ({ page }) => {
    await page.route('**/api/calendar-groups', (route) => route.fulfill({ json: { groups: [
      { id: 'g-robin', name: 'Robin', color: '#e11d48', type: 'user' },
      { id: 'g-family', name: 'Family', color: '#2563eb', type: 'family' },
    ] } }));
    await page.clock.setFixedTime(new Date(NOON));
    await weatherAt(page, { lat: 45, lon: -100 });
    await screenIdles(page, BACKGROUNDS.photos);
    await page.route('**/api/layouts', (route) => route.request().method() === 'GET'
      ? route.fulfill({ json: { layouts: [{
        ...idleLayout(BACKGROUNDS.photos),
        screensaverWidgets: [{ i: 'calendar', x: 0, y: 0, w: 24, h: 24, visible: true }],
      }] } })
      : route.fallback());
    await page.addInitScript(() => localStorage.setItem('prism-perf-mode', 'false'));
    await page.goto('/');
    await page.locator('.widget-cell[data-widget="clock"]').waitFor({ timeout: 60000 });
    await waitForQuiet(page);
    await page.evaluate(() => window.dispatchEvent(new Event('prism:screensaver')));

    // On a cleared cell, where every other backing is gone.
    const chip = page.locator('[data-screensaver] .widget-cell.idle-clear [data-calendar-chip="g-robin"]');
    await expect(chip).toBeVisible({ timeout: 15000 });
    expect(await chip.evaluate((el) => getComputedStyle(el).backgroundColor), 'Robin keeps red').toBe('rgb(225, 29, 72)');
    const family = page.locator('[data-screensaver] .widget-cell.idle-clear [data-calendar-chip="g-family"]');
    expect(await family.evaluate((el) => getComputedStyle(el).backgroundColor), 'Family keeps blue').toBe('rgb(37, 99, 235)');
  });

  test('Night sky fills the screen instead of the photos', async ({ page }) => {
    await openScreensaver(page, 'sky', NIGHT);
    const s = await sky(page);
    expect(s, 'the sky canvas is drawn').not.toBeNull();
    expect(s!.x).toBe(0);
    expect(s!.y).toBe(0);
    expect(Math.abs(s!.w - 1280)).toBeLessThanOrEqual(1);
    expect(Math.abs(s!.h - 720)).toBeLessThanOrEqual(1);
    expect(s!.alpha, 'the sky is painted, not a blank canvas').toBe(255);
  });

  test('the Milky Way glows where it is in the sky, and not elsewhere', async ({ page }) => {
    // Two points at about the same height on screen: one on the band in
    // Cygnus, one well off it in Hercules. The band is the only thing that
    // can make the first brighter than the second; a median over a patch
    // keeps a stray star from deciding it.
    await openScreensaver(page, 'sky', DEEP);
    const view = { width: 1280, height: 720, facing: facingFor(45) };
    const lst = localSiderealTime(new Date(DEEP), -100);
    const on = project(toHorizontal(300, 30, 45, lst), view);
    const off = project(toHorizontal(250, 20, 45, lst), view);
    const [band, beside] = await page.evaluate(([a, b]) => {
      const el = document.querySelector<HTMLCanvasElement>('[data-testid="night-sky"]')!;
      const ctx = el.getContext('2d')!;
      const k = el.width / el.clientWidth;
      const median = (p: { x: number; y: number }) => {
        const size = Math.round(24 * k);
        const d = ctx.getImageData(Math.round(p.x * k - size / 2), Math.round(p.y * k - size / 2), size, size).data;
        const lum: number[] = [];
        for (let i = 0; i < d.length; i += 4) lum.push(0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!);
        lum.sort((x, y) => x - y);
        return lum[lum.length >> 1]!;
      };
      return [median(a), median(b)];
    }, [on, off] as const);
    expect(band - beside, `on the band ${band.toFixed(1)}, beside it ${beside.toFixed(1)}`).toBeGreaterThan(12);
  });

  test('the Milky Way is grainy with faint stars, not a smooth haze', async ({ page }) => {
    // A smooth glow, however bright, reads as thin cloud; the band's grain of
    // unresolved stars is what makes it read as the galaxy. So within a patch
    // on the band, neighbouring pixels must differ: measured as the mean step
    // in brightness from each pixel to the next, which a blurred glow keeps
    // near zero and a scatter of points does not.
    await openScreensaver(page, 'sky', DEEP);
    const view = { width: 1280, height: 720, facing: facingFor(45) };
    const lst = localSiderealTime(new Date(DEEP), -100);
    const on = project(toHorizontal(300, 30, 45, lst), view);
    const grain = await page.evaluate((p) => {
      const el = document.querySelector<HTMLCanvasElement>('[data-testid="night-sky"]')!;
      const k = el.width / el.clientWidth;
      const size = Math.round(40 * k);
      const d = el.getContext('2d')!
        .getImageData(Math.round(p.x * k - size / 2), Math.round(p.y * k - size / 2), size, size).data;
      const lum = (i: number) => 0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!;
      let sum = 0;
      let n = 0;
      for (let y = 0; y < size; y++) {
        for (let x = 1; x < size; x++) {
          sum += Math.abs(lum((y * size + x) * 4) - lum((y * size + x - 1) * 4));
          n++;
        }
      }
      return sum / n;
    }, on);
    expect(grain, `mean step between neighbouring pixels on the band: ${grain.toFixed(2)}`).toBeGreaterThan(3);
  });

  test('the brightest stars twinkle, unless motion is reduced', async ({ page }) => {
    await openScreensaver(page, 'sky', DEEP);
    const twinkles = page.getByTestId('night-sky-twinkle');
    expect(await twinkles.count()).toBeGreaterThan(2);
    // Each sits on its star, inside the sky.
    for (const box of await twinkles.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()))) {
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      expect(cx).toBeGreaterThan(0);
      expect(cx).toBeLessThan(1280);
      expect(cy).toBeGreaterThan(0);
      expect(cy).toBeLessThan(720);
    }

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(twinkles).toHaveCount(0);
  });

  test('a shooting star crosses every few minutes', async ({ page }) => {
    // The clock runs here rather than standing still, so minutes can pass.
    await page.clock.install({ time: new Date(DEEP) });
    await openScreensaver(page, 'sky', DEEP);
    await expect(page.getByTestId('night-sky-meteor')).toHaveCount(0);
    // Its streak plays on real time and removes itself when done, which can be
    // before the fake minutes have finished passing; so count it arriving.
    await page.evaluate(() => {
      const w = window as unknown as { meteors: number };
      w.meteors = 0;
      new MutationObserver((changes) => {
        for (const c of changes) {
          for (const n of c.addedNodes) {
            if (n instanceof HTMLElement && n.dataset.testid === 'night-sky-meteor') w.meteors++;
          }
        }
      }).observe(document.body, { childList: true, subtree: true });
    });
    await page.clock.runFor(6 * 60_000);
    expect(await page.evaluate(() => (window as unknown as { meteors: number }).meteors)).toBeGreaterThanOrEqual(1);
  });

  test('teaches one constellation at a time, traced from its brightest star', async ({ page }) => {
    await page.clock.install({ time: new Date(DEEP) });
    await openScreensaver(page, 'sky', DEEP);
    const lesson = page.getByTestId('night-sky-constellation');
    await expect(lesson).toHaveCount(0);
    await page.clock.runFor(13_000);
    await expect(lesson).toHaveCount(1);

    const id = (await lesson.getAttribute('data-figure'))!;
    const fig = FIGURES.find((f) => f.id === id)!;
    await expect(page.getByTestId('night-sky-constellation-name')).toHaveText(fig.name);
    // The first lines leave from the figure's brightest star.
    let brightest = 0;
    for (let i = 0; i < fig.v.length / 3; i++) if (fig.v[i * 3 + 2]! < fig.v[brightest * 3 + 2]!) brightest = i;
    const first = page.locator('[data-testid="night-sky-stroke"][data-depth="0"]');
    expect(await first.count()).toBeGreaterThan(0);
    for (const from of await first.evaluateAll((els) => els.map((e) => e.getAttribute('data-from')))) {
      expect(Number(from)).toBe(brightest);
    }
    // All of it on screen.
    const box = (await lesson.locator('svg').evaluate((svg) => {
      const r = (svg as SVGSVGElement).querySelector('g')!.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    }));
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(1280);
    expect(box.bottom).toBeLessThanOrEqual(720);
    // The display remembers it, so the next one is a different figure.
    const taught = await page.evaluate(() => JSON.parse(localStorage.getItem('prism-night-sky-taught') ?? '{}'));
    expect(Object.keys(taught)).toEqual([id]);

    // And with reduced motion it is shown whole, without the trace.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    let next: string | null = id;
    for (let s = 0; s < 120 && (next === id || next === null); s += 5) {
      await page.clock.runFor(5_000);
      next = await lesson.count() ? await lesson.getAttribute('data-figure') : null;
    }
    expect(next).not.toBeNull();
    expect(next).not.toBe(id);
    await expect(lesson).toHaveClass(/night-sky-still/);
  });

  test('names a meteor shower on its peak night, and not outside it', async ({ page }) => {
    // The Geminids peak on 14 December, their radiant high in the south-east
    // at midnight, so it is on screen and marked.
    await openScreensaver(page, 'sky', '2026-12-14T07:00:00Z');
    await expect(page.getByTestId('night-sky-shower')).toContainText('Geminids peak tonight');
    const radiant = await page.getByTestId('night-sky-radiant').boundingBox();
    expect(radiant, 'the radiant is marked').not.toBeNull();
    expect(radiant!.x > 0 && radiant!.x < 1280 && radiant!.y > 0 && radiant!.y < 720, 'on screen').toBe(true);

    await page.clock.setFixedTime(new Date('2026-12-26T07:00:00Z'));
    await page.reload();
    await waitForQuiet(page);
    await page.evaluate(() => window.dispatchEvent(new Event('prism:screensaver')));
    await page.locator('[data-testid="night-sky"]').waitFor();
    await page.waitForTimeout(1500);
    await expect(page.getByTestId('night-sky-shower')).toHaveCount(0);
  });

  test('says when aurora may be visible, and leaves the line off when the forecast fails', async ({ page }) => {
    // The forecast itself is NOAA's and changes by the hour, so the server's
    // answer is handed over: aurora low in the north tonight.
    await page.route('**/api/aurora', (route) => route.fulfill({ json: { enabled: true, chance: 'horizon' } }));
    await openScreensaver(page, 'sky', DEEP);
    await expect(page.getByTestId('night-sky-aurora')).toHaveText('Aurora possible now, low in the northern sky');
    const line = await page.getByTestId('night-sky-aurora').boundingBox();
    expect(line!.y, 'at the top of the sky').toBeLessThan(720 * 0.2);

    // NOAA did not answer: no line, and the sky draws as normal.
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await page.route('**/api/aurora', (route) => route.fulfill({ status: 502, json: { error: 'Aurora forecast unavailable' } }));
    await openScreensaver(page, 'sky', DEEP);
    await expect(page.getByTestId('night-sky-aurora')).toHaveCount(0);
    expect((await sky(page))!.alpha, 'the sky is drawn').toBe(255);
  });

  test('asks for no aurora forecast by day', async ({ page }) => {
    let asked = 0;
    await page.route('**/api/aurora', (route) => {
      asked++;
      return route.fulfill({ json: { enabled: true, chance: 'overhead' } });
    });
    await openScreensaver(page, 'sky', NOON);
    await page.locator('[data-testid="night-sky"]').waitFor();
    await page.waitForTimeout(2000);
    expect(asked, 'a plain daytime sky fetches nothing').toBe(0);
    await expect(page.getByTestId('night-sky-aurora')).toHaveCount(0);
  });

  test('the moon is copper during a lunar eclipse seen from here', async ({ page }) => {
    // The total lunar eclipse of 3 March 2026, at its peak. The eclipse comes
    // from the weather response, which works it out for the server's today, so
    // the test hands it over for the fixed date. The place is a point in the
    // open Pacific where it is local midnight and the moon is high.
    const peak = '2026-03-03T11:33:00Z';
    const place = { lat: 30, lon: -160 };
    const moon = moonPosition(new Date(peak), place.lat, place.lon);
    expect(moon.alt, 'precondition: the moon is up at the peak').toBeGreaterThan(5);
    const at = project(moon, { width: 1280, height: 720, facing: facingFor(place.lat) });
    expect(at.x > 20 && at.x < 1260 && at.y > 20 && at.y < 700, 'precondition: the moon is on screen').toBe(true);

    const moonPixel = () => page.evaluate(({ x, y }) => {
      const el = document.querySelector<HTMLCanvasElement>('[data-testid="night-sky"]')!;
      const k = el.width / el.clientWidth;
      const [r, g, b] = el.getContext('2d')!.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data;
      return { r: r!, g: g!, b: b! };
    }, at);

    await openScreensaver(page, 'sky', peak, {
      ...place,
      eclipse: { body: 'moon', kind: 'total', begin: '2026-03-03T09:50:00Z', peak, end: '2026-03-03T13:17:00Z', obscuration: 1 },
    });
    const copper = await moonPixel();
    expect(copper.r - copper.b, 'red well above blue: copper').toBeGreaterThan(80);

    // The same moon with no eclipse is near white.
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await openScreensaver(page, 'sky', peak, { ...place, eclipse: null });
    const white = await moonPixel();
    expect(white.r - white.b, 'no eclipse: near white').toBeLessThan(40);
  });

  test('after dark shows photos at noon and the sky at midnight', async ({ page }) => {
    await openScreensaver(page, 'dayNight', NOON);
    expect(await sky(page), 'local noon: photos, no sky').toBeNull();

    await page.clock.setFixedTime(new Date(NIGHT));
    await page.reload();
    await waitForQuiet(page);
    await page.evaluate(() => window.dispatchEvent(new Event('prism:screensaver')));
    await page.locator('[data-testid="night-sky"]').waitFor();
    expect((await sky(page))!.alpha).toBe(255);
  });

  // #1345: how a screen idles is the screen's own, so a switch to another
  // dashboard, even one that once kept another night look, idles the same.
  test('the screen idles by its own day whichever dashboard is up', async ({ page }) => {
    const hall = {
      ...idleLayout({ day: 'photos', night: 'photos', switch: { by: 'sun', duskOffset: 0, dawnOffset: 0 } }),
      id: '00000000-0000-4000-8000-000000001281', name: 'Hall e2e', slug: 'hall-e2e', isDefault: false,
    };
    await openDashboard(page, BACKGROUNDS.dayNight, NIGHT);
    // Both dashboards from here on (the route added last answers first).
    await page.route('**/api/layouts', (route) => route.request().method() === 'GET'
      ? route.fulfill({ json: { layouts: [idleLayout(BACKGROUNDS.dayNight), hall] } })
      : route.fallback());
    const restOn = async (slug: string) => {
      await page.goto(`/d/${slug}`);
      await page.locator('.widget-cell[data-widget="clock"]').waitFor({ timeout: 60000 });
      await waitForQuiet(page);
      await page.evaluate(() => window.dispatchEvent(new Event('prism:screensaver')));
      await page.locator('.fixed.inset-0.z-9999').waitFor();
      await page.waitForTimeout(1500);
      return sky(page);
    };
    expect((await restOn('hall-e2e'))?.alpha, 'Hall: the screen\'s night sky').toBe(255);
    expect((await restOn('idle-e2e'))?.alpha, 'Idle: the night sky').toBe(255);
    expect((await restOn('hall-e2e'))?.alpha, 'Hall again: the night sky').toBe(255);
  });

  test('a dashboard by day and the sky after dark: calm at noon, the sky at midnight', async ({ page }) => {
    const background: IdleBackground = { day: 'dashboard', night: 'sky', switch: { by: 'sun', duskOffset: 0, dawnOffset: 0 } };
    await openDashboard(page, background, NOON);
    await page.waitForTimeout(1500);
    expect(await page.locator('.fixed.inset-0.z-9999').count(), 'noon: no screensaver over the dashboard').toBe(0);
    expect(await sky(page), 'noon: no sky').toBeNull();
    await expect(page.locator('.widget-cell[data-widget="clock"]')).toBeVisible();

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await openDashboard(page, background, NIGHT);
    await page.locator('[data-testid="night-sky"]').waitFor();
    expect((await sky(page))!.alpha).toBe(255);
  });
});

/**
 * Calm mode (#691): a dashboard that is its own idle screen. Going idle fades
 * out the widgets not ticked to stay and leaves every widget exactly where it
 * was; waking brings them back. Nothing moves, and the separate screensaver
 * does not come up over it.
 */
test.describe('calm mode idle screen', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database to log in and create a dashboard');
  test.use({ viewport: { width: 1280, height: 720 } });
  // The editor loads the dashboard twice (the page and its frame), slow on a cold CI server.
  test.setTimeout(180_000);
  // The screen idles as its dashboard (#1345).
  test.beforeEach(async ({ page }) => { await screenIdles(page, { source: 'dashboard' }); });

  // Clock and Tasks rely on the default ticks; Shopping and Weather override them.
  // The clock is glass, which goes clear on the idle screen.
  const WIDGETS = [
    { i: 'clock', x: 0, y: 0, w: 16, h: 12, backgroundColor: 'glass' },
    { i: 'tasks', x: 16, y: 0, w: 16, h: 12 },
    { i: 'shopping', x: 32, y: 0, w: 16, h: 12, showWhenIdle: true },
    { i: 'weather', x: 0, y: 12, w: 16, h: 12, showWhenIdle: false },
  ];
  const SHOWN = ['clock', 'shopping'];
  const FADED = ['tasks', 'weather'];

  type Cell = Box & { opacity: number; hit: boolean };
  async function cells(page: Page): Promise<Record<string, Cell>> {
    return page.evaluate(() => {
      const out: Record<string, { x: number; y: number; w: number; h: number; opacity: number; hit: boolean }> = {};
      document.querySelectorAll<HTMLElement>('.widget-cell[data-widget]').forEach((el) => {
        const b = el.getBoundingClientRect();
        // What a tap at the widget's centre would land on.
        const at = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
        out[el.dataset.widget!] = {
          x: b.x, y: b.y, w: b.width, h: b.height,
          opacity: Number(getComputedStyle(el).opacity),
          hit: !!at && el.contains(at),
        };
      });
      return out;
    });
  }

  /** The clock cell's fill alpha, and whether its text carries a shadow. */
  async function clockFill(page: Page) {
    return page.locator('.widget-cell[data-widget="clock"]').evaluate((el) => {
      const cs = getComputedStyle(el);
      const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/);
      const parts = m ? m[1]!.split(/[ ,/]+/).filter(Boolean) : [];
      const alpha = parts.length === 4 ? Number(parts[3]) : parts.length === 3 ? 1 : 0;
      return { alpha, blur: cs.backdropFilter, shadow: cs.textShadow };
    });
  }

  test('going idle fades the unticked widgets in place, and waking brings them back', async ({ page }) => {
    const login = await page.request.post('/api/auth/login', {
      data: { userId: getSeededParentId(), pin: PIN },
    });
    expect(login.ok(), 'precondition: login must succeed').toBe(true);
    const created = await page.request.post('/api/layouts', {
      data: { name: `Calm e2e ${Date.now()}`, widgets: WIDGETS },
    });
    expect(created.status()).toBe(201);
    const layout = await created.json();
    // A dashboard created now is calm without being asked.
    expect(layout.idleBackground).toEqual({ source: 'dashboard' });

    // Drift takes its phase from the wall clock (every widget in step), so fix
    // the clock a quarter of the way into the 96 s cycle: the far right of the
    // figure eight, 4 px out, the moment the display goes idle.
    const base = Date.UTC(2026, 9, 27, 12);
    await page.clock.setFixedTime(new Date(base - (base % 96_000) + 24_000));
    try {
      await page.goto(`/d/${layout.slug}`);
      await page.locator('.widget-cell[data-widget="clock"]').waitFor({ timeout: 60000 });
      await page.waitForTimeout(800);
      const before = await cells(page);
      expect(Object.keys(before).sort()).toEqual(WIDGETS.map((w) => w.i).sort());
      const glass = await clockFill(page);
      expect(glass.alpha, 'premise: the clock is glass while awake').toBeGreaterThan(0.2);

      await page.evaluate(() => window.dispatchEvent(new Event('prism:screensaver')));
      await page.waitForTimeout(1500);
      const idle = await cells(page);
      // The glass clock that stays goes clear, with shadowed text, on the photo.
      const clear = await clockFill(page);
      expect(clear.alpha, 'idle glass is clear').toBe(0);
      expect(clear.blur, 'idle glass has no blur').toBe('none');
      expect(clear.shadow, 'idle text has a shadow').not.toBe('none');

      // The separate screensaver did not come up over the dashboard.
      await expect(page.locator('.fixed.inset-0 .widget-cell')).toHaveCount(0);
      // Nothing changes size or place. The widgets that stay drift, but only
      // within the 4 px figure eight.
      const off = (i: string, from: Record<string, Cell>, to: Record<string, Cell>) =>
        Math.hypot(to[i]!.x - from[i]!.x, to[i]!.y - from[i]!.y);
      for (const i of [...SHOWN, ...FADED]) {
        expect(Math.abs(idle[i]!.w - before[i]!.w), `${i} width`).toBeLessThanOrEqual(1);
        expect(Math.abs(idle[i]!.h - before[i]!.h), `${i} height`).toBeLessThanOrEqual(1);
      }
      for (const i of SHOWN) expect(off(i, before, idle), `${i} drifts within its amplitude`).toBeLessThanOrEqual(4.5);
      for (const i of FADED) expect(off(i, before, idle), `faded ${i} stays put`).toBeLessThanOrEqual(1);
      // The fixed clock puts it about 4 px out by now.
      expect(off('clock', before, idle), 'the clock is drifting').toBeGreaterThan(3);
      for (const i of SHOWN) {
        expect(idle[i]!.opacity, `${i} stays`).toBe(1);
        expect(idle[i]!.hit, `a tap on ${i} reaches it`).toBe(true);
      }
      for (const i of FADED) {
        expect(idle[i]!.opacity, `${i} fades`).toBe(0);
        expect(idle[i]!.hit, `a tap on faded ${i} does not press it`).toBe(false);
      }

      // The first touch after the toolbar's forced start is absorbed (see
      // useIdleDetection); the second wakes the display.
      const tasks = idle.tasks!;
      for (let n = 0; n < 2; n++) await page.mouse.click(tasks.x + tasks.w / 2, tasks.y + tasks.h / 2);
      // Waking eases a drifted widget home over a second; it does not snap.
      const waking = await cells(page);
      expect(off('clock', before, waking), 'the clock glides back, not jumps').toBeGreaterThan(1.5);
      await page.waitForTimeout(1500);
      const awake = await cells(page);
      expect((await clockFill(page)).alpha, 'the glass is back on waking').toBeGreaterThan(0.2);
      for (const i of [...SHOWN, ...FADED]) {
        expect(awake[i]!.opacity, `${i} is back`).toBe(1);
        expect(off(i, before, awake), `${i} is back in its place`).toBeLessThanOrEqual(1);
      }
    } finally {
      await page.request.delete(`/api/layouts/${layout.id}`);
    }
  });

  test('at the Minimal performance level the idle fade is a blink', async ({ page }) => {
    const login = await page.request.post('/api/auth/login', {
      data: { userId: getSeededParentId(), pin: PIN },
    });
    expect(login.ok(), 'precondition: login must succeed').toBe(true);
    const created = await page.request.post('/api/layouts', {
      data: { name: `Calm perf e2e ${Date.now()}`, widgets: WIDGETS },
    });
    expect(created.status()).toBe(201);
    const layout = await created.json();
    try {
      // Chosen the way a person would: in the editor's Screen > Advanced (#1159, #1349).
      await page.goto(`/d/${layout.slug}`);
      await openEditor(page);
      await openSheet(page, 'screen');
      await page.getByRole('button', { name: /^Advanced: orientation/ }).click();
      await page.locator('[data-screen-options]').getByLabel('Performance').selectOption({ label: 'Minimal' });
      // Held until Done, like everything in the editor (#1341); Done keeps it
      // in this browser and goes back to the dashboard.
      await expect(page.locator('html')).not.toHaveClass(/perf-minimal/);
      await done(page).click();
      await backOn(page, layout.slug);
      await expect(page.locator('html')).toHaveClass(/perf-minimal/);

      await page.goto(`/d/${layout.slug}`);
      await page.locator('.widget-cell[data-widget="tasks"]').waitFor({ timeout: 60000 });
      await page.waitForTimeout(800);
      await page.evaluate(() => window.dispatchEvent(new Event('prism:screensaver')));
      // A third of the ordinary one-second fade: it would still be most of the
      // way visible, and a blink is long gone.
      await page.waitForTimeout(350);
      const idle = await cells(page);
      for (const i of FADED) expect(idle[i]!.opacity, `${i} is already gone`).toBe(0);
    } finally {
      await page.request.delete(`/api/layouts/${layout.id}`);
    }
  });

  test('Done with nothing changed leaves the dashboard as it was, and it still rests the same', async ({ page }) => {
    const login = await page.request.post('/api/auth/login', {
      data: { userId: getSeededParentId(), pin: PIN },
    });
    expect(login.ok(), 'precondition: login must succeed').toBe(true);
    const created = await page.request.post('/api/layouts', {
      data: { name: `Calm done e2e ${Date.now()}`, widgets: WIDGETS },
    });
    expect(created.status()).toBe(201);
    const layout = await created.json();
    expect(layout.screensaverWidgets, 'premise: no screensaver layout of its own').toBeNull();
    await page.addInitScript(() => localStorage.setItem('prism-screensaver-drift', 'off'));
    try {
      await page.goto(`/d/${layout.slug}`);
      await openEditor(page);
      const save = page.waitForResponse((r) => r.url().endsWith(`/api/layouts/${layout.id}`) && r.request().method() === 'PATCH');
      await done(page).click();
      expect((await save).ok()).toBe(true);
      await backOn(page, layout.slug);
      await expect(page.locator('[data-canvas-toggles]')).toHaveCount(0);

      const saved = await (await page.request.get(`/api/layouts/${layout.id}`)).json();
      expect(saved.screensaverWidgets, 'Done saved no screensaver layout of its own').toBeNull();
      expect(saved.idleBackground).toEqual(layout.idleBackground);
      expect(saved.widgets).toEqual(layout.widgets);

      await page.reload();
      await page.locator('.widget-cell[data-widget="weather"]').waitFor({ timeout: 60000 });
      await page.waitForTimeout(800);
      await page.evaluate(() => window.dispatchEvent(new Event('prism:screensaver')));
      await page.waitForTimeout(1500);
      const idle = await cells(page);
      expect(idle.weather!.opacity, 'weather still fades').toBe(0);
      expect(idle.shopping!.opacity, 'shopping still stays').toBe(1);
    } finally {
      await page.request.delete(`/api/layouts/${layout.id}`);
    }
  });

  test('Stays / Fades is on the Idle screen tab, and one Save keeps it with the background', async ({ page }) => {
    const login = await page.request.post('/api/auth/login', {
      data: { userId: getSeededParentId(), pin: PIN },
    });
    expect(login.ok(), 'precondition: login must succeed').toBe(true);
    // Neither widget is set, so the defaults decide: the clock stays, tasks fade.
    const created = await page.request.post('/api/layouts', {
      data: { name: `Calm ticks e2e ${Date.now()}`, widgets: WIDGETS.slice(0, 2) },
    });
    expect(created.status()).toBe(201);
    const layout = await created.json();
    // Keep the widgets still, so a drifted clock cannot read as moved.
    await page.addInitScript(() => localStorage.setItem('prism-screensaver-drift', 'off'));
    try {
      await page.goto(`/d/${layout.slug}`);
      const frame = await openEditor(page);
      const toggle = (i: string) => frame.locator(`[data-editor-widget="${i}"] [data-idle-toggle]`);
      // In use or idle, on the canvas's toggles (#1348).
      const see = (state: 'active' | 'resting') => canvasShows(page, state === 'active' ? 'in-use' : 'idle', 'day');
      const dot = (id: string) => page.locator(`[data-editor-open="${id}"] [aria-label="unsaved changes"]`);
      // In use, the dashboard is arranged; what stays when idle is set on the idle canvas.
      await expect(page.locator('[data-canvas-pick="in-use"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(frame.locator('[data-idle-toggle]')).toHaveCount(0);
      await openSheet(page, 'screen');
      // Opening Screen leaves the canvas in use; Idle shows it idle.
      await expect(frame.locator('[data-idle-toggle]')).toHaveCount(0);
      await see('resting');
      await expect(toggle('clock')).toHaveAttribute('aria-pressed', 'true');
      await expect(toggle('clock')).toContainText('Stays');
      await expect(toggle('tasks')).toHaveAttribute('aria-pressed', 'false');
      await expect(toggle('tasks')).toContainText('Fades');

      await toggle('tasks').click();
      await toggle('clock').click();
      await expect(toggle('tasks')).toHaveAttribute('aria-pressed', 'true');
      await expect(toggle('clock')).toHaveAttribute('aria-pressed', 'false');
      // The button changes only this; it does not select the widget to move it.
      await expect(frame.getByText(/^Tap to (resize|deselect)$/)).toHaveCount(0);
      // Only Widgets is marked as changed: what stays is the dashboard's (#1349).
      await expect(dot('widgets')).toBeVisible();
      await expect(dot('screen')).toHaveCount(0);

      // Back to in use and to resting again: the unsaved ticks are still there.
      await see('active');
      await expect(frame.locator('[data-idle-toggle]')).toHaveCount(0);
      await see('resting');

      // A photo frame: the canvas becomes its arrangement. Then back to this
      // dashboard, which is what gets saved. What shows idle by day is a row
      // of Screen > When idle (#1349).
      const behind = (label: string) => page.locator('[data-editor-sheet="screen"]').getByLabel('By day it shows').selectOption({ label });
      await behind('A photo frame');
      await expect(frame.locator('[data-idle-toggle]')).toHaveCount(0);
      await expect(frame.locator('[data-editor-widget]').first()).toBeVisible();
      await behind('The dashboard, quieter');
      await expect(toggle('tasks')).toHaveAttribute('aria-pressed', 'true');
      // Nothing is stored before Save.
      const before = await (await page.request.get(`/api/layouts/${layout.id}`)).json();
      expect(before.widgets.map((w: { showWhenIdle?: boolean }) => w.showWhenIdle)).toEqual([undefined, undefined]);

      await done(page).click();
      await backOn(page, layout.slug);
      await expect(page.locator('[data-idle-toggle]')).toHaveCount(0);
      const saved = await (await page.request.get(`/api/layouts/${layout.id}`)).json();
      const tick = Object.fromEntries(saved.widgets.map((w: { i: string; showWhenIdle?: boolean }) => [w.i, w.showWhenIdle]));
      expect(tick).toEqual({ clock: false, tasks: true });
      expect(saved.idleBackground).toEqual({ source: 'dashboard' });

      await page.locator('.widget-cell[data-widget="clock"]').waitFor();
      await page.evaluate(() => window.dispatchEvent(new Event('prism:screensaver')));
      await page.waitForTimeout(1500);
      const idle = await cells(page);
      expect(idle.tasks!.opacity, 'tasks now stays').toBe(1);
      expect(idle.clock!.opacity, 'the clock now fades').toBe(0);
    } finally {
      await page.request.delete(`/api/layouts/${layout.id}`);
    }
  });
});

/**
 * The screen's day on its Screen tab (#1349): what it shows idle by day and
 * at night, each shown on the canvas as it is picked, when night is under
 * Advanced with tonight's times and the offsets, saved to the screen on Done;
 * the strip shades night; offsets that cross near midsummer far north are
 * refused.
 */
test.describe('idle background picker', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database to log in and create a dashboard');
  test.use({ viewport: { width: 1600, height: 900 } });
  // The editor loads the dashboard twice (the page and its frame), slow on a cold CI server.
  test.setTimeout(180_000);

  /**
   * A dashboard with the clock and tasks, open in the editor on Screen: its
   * own canvas, or with `asScreen` this browser's screen's editor.
   */
  async function editIdle(page: Page, place: { lat: number; lon: number }, idleBackground: IdleBackground = { source: 'dashboard' }, asScreen = false, nightLevel: 0 | 25 | 50 | 75 = 0) {
    const login = await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } });
    expect(login.ok(), 'precondition: login must succeed').toBe(true);
    // The idle look is the screen's (#1345), not the dashboard's.
    await screenIdles(page, idleBackground, nightLevel);
    const created = await page.request.post('/api/layouts', {
      data: { name: `Behind it e2e ${Date.now()}`, widgets: [{ i: 'clock', x: 0, y: 0, w: 16, h: 12 }, { i: 'tasks', x: 16, y: 0, w: 16, h: 12 }] },
    });
    expect(created.status()).toBe(201);
    const layout = await created.json();
    await weatherAt(page, place);
    let frame: FrameLocator;
    let removeScreen = async (): Promise<unknown> => undefined;
    if (asScreen) ({ frame, removeScreen } = await editAsScreen(page, layout.id));
    else {
      await page.goto(`/d/${layout.slug}`);
      frame = await openEditor(page);
    }
    await openSheet(page, 'screen');
    return { id: layout.id as string, frame, removeScreen };
  }

  test('idle by day and at night each show on the canvas, an edge moves, and Done saves it to the screen', async ({ page }) => {
    const layout = await editIdle(page, { lat: 45, lon: -100 });
    const { frame } = layout;
    try {
      const sheet = page.locator('[data-editor-sheet="screen"]');
      // Idle by day is the dashboard, quieter: Stays / Fades.
      await canvasShows(page, 'idle', 'day');
      await expect(frame.locator('[data-idle-toggle]').first()).toBeVisible();
      await expect(sheet.locator('[data-idle-head="night"]')).toHaveText('At night (dusk to dawn)');
      await expect(sheet.getByLabel('At night it shows')).toHaveValue('same');
      // Picking a night look shows it: idle at night on the canvas's toggles.
      await sheet.getByLabel('At night it shows').selectOption({ label: 'The night sky' });
      await expect(page.locator('[data-canvas-above] [data-canvas-pick="night"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(frame.locator('[data-idle-toggle]')).toHaveCount(0);
      await canvasShows(page, 'day');
      await expect(frame.locator('[data-idle-toggle]').first()).toBeVisible();
      await canvasShows(page, 'in-use');
      // The strip shades the night by the screen's rule.
      await expect(sheet.locator('[data-strip-night]').first()).toBeVisible();
      await expect(sheet.locator('[data-strip-caption]')).toHaveText('Today. Shaded: night (dusk to dawn). Line: now.');

      // Under Advanced: tonight's times, and the end of night an hour before dawn.
      await expect(sheet.getByLabel('Night is')).toHaveCount(0);
      await sheet.getByRole('button', { name: /^Advanced: when night is/ }).click();
      await expect(sheet.locator('[data-night-start]')).toContainText(/\d/);
      await expect(sheet.locator('[data-night-end]')).toContainText(/\d/);
      await page.getByLabel('Ends: unit').selectOption('hr');
      await page.getByLabel('Ends: amount').fill('1');
      await expect(page.locator('[data-idle-crossed]')).toHaveCount(0);
      // Nothing is kept before Done.
      expect(await storedDay(page)).toMatchObject({ day: 'dashboard', night: 'dashboard' });

      await done(page).click();
      await expect(page.locator('[data-editor-bar]')).toHaveCount(0);
      // Done saves it to the screen's day (#1345), how dark kept, and leaves
      // the dashboard's own old look alone.
      expect(await storedDay(page)).toEqual({
        day: 'dashboard', night: 'sky', switch: { by: 'sun', duskOffset: 30, dawnOffset: -60 }, nightLevel: 0,
      });
      const saved = await (await page.request.get(`/api/layouts/${layout.id}`)).json();
      expect(saved.idleBackground).toEqual({ source: 'dashboard' });
    } finally {
      await page.request.delete(`/api/layouts/${layout.id}`);
    }
  });

  // #1349: the Screen tab in its order, the sentence first, the When idle
  // rows lined up in their columns, all inside the panel.
  test('the sentence and the strip first, then the rows, the idle columns lined up, all inside the panel', async ({ page }) => {
    const layout = await editIdle(page, { lat: 45, lon: -100 }, { day: 'photos', night: 'sky', switch: { by: 'clock', from: '21:00', to: '06:30' } }, true);
    try {
      const sheet = page.locator('[data-editor-sheet="screen"]');
      // No See it (#1348): the canvas's toggles above it say what it draws.
      await expect(sheet.locator('[data-see-it], [data-see="resting"], [data-day-back], [data-day-slider]')).toHaveCount(0);
      await expect(page.locator('[data-canvas-above] [data-canvas-toggles]')).toBeVisible();
      await expect(sheet.locator('[data-screen-sentence]')).toContainText('Idle for 2 minutes, it becomes a photo frame. At night it becomes the night sky.');
      await expect(sheet.getByLabel('At night it shows').locator('option', { hasText: 'A photo frame' })).toHaveCount(0);
      await expect(sheet.getByLabel('At night it shows').locator('option', { hasText: 'The dashboard, quieter' })).toHaveCount(1);
      await expect(sheet.getByRole('button', { name: 'Arrange the photo frame' })).toBeVisible();
      await sheet.getByRole('button', { name: /^Advanced: when night is/ }).click();
      for (const label of ['Idle after', 'By day it shows', 'At night it shows', 'Darker at night', 'Night is', 'Night starts', 'Night ends', 'Transition effect']) {
        await expect(sheet.getByLabel(label, { exact: true }), label).toBeVisible();
      }
      const g = await sheet.evaluate((root) => {
        const box = (sel: string) => root.querySelector(sel)!.getBoundingClientRect().toJSON() as DOMRect;
        return {
          overflow: root.scrollWidth - root.clientWidth,
          sentence: box('[data-screen-sentence]'),
          strip: box('[data-day-strip]'),
          shows: box('[data-screen-plan]'),
          idle: box('[data-screen-own]'),
          day: box('[data-idle-day]'),
          night: box('[data-idle-night]'),
          darker: box('[data-idle-darker]'),
          headDay: box('[data-idle-head="day"]'),
          headNight: box('[data-idle-head="night"]'),
        };
      });
      expect(g.overflow, 'nothing runs past the panel').toBeLessThanOrEqual(0);
      // The sentence, the strip, Shows, When idle, top to bottom.
      expect(g.sentence.bottom).toBeLessThanOrEqual(g.strip.top);
      expect(g.strip.bottom).toBeLessThanOrEqual(g.shows.top);
      expect(g.shows.bottom).toBeLessThanOrEqual(g.idle.top);
      // By day and At night are two columns: each heading over its own controls.
      expect(Math.abs(g.day.left - g.headDay.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(g.night.left - g.headNight.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(g.darker.left - g.night.left)).toBeLessThanOrEqual(1);
      expect(g.night.left).toBeGreaterThanOrEqual(g.day.right);
    } finally {
      await layout.removeScreen();
      await page.request.delete(`/api/layouts/${layout.id}`);
    }
  });

  // #1348: the canvas draws what the wall draws, in each of the four states
  // its toggles pick: the photo or the sky, the fading, and the darkness over
  // every look, measured on the frame.
  test('In use | Idle and Day | Night draw the wall\'s scene: the photo or sky, the fading and the darkness over every look', async ({ page }) => {
    const layout = await editIdle(page, { lat: 45, lon: -100 },
      { day: 'dashboard', night: 'photos', switch: { by: 'clock', from: '21:00', to: '06:30' } }, false, 50);
    const { frame } = layout;
    try {
      const caption = page.locator('[data-canvas-below] [data-canvas-caption]');
      const size = await frame.locator('body').evaluate(() => `${window.innerWidth} x ${window.innerHeight}`);
      /** What the frame draws: the darkness over it, the backdrop, and each widget's opacity. */
      const drawn = () => frame.locator('body').evaluate(() => {
        const dark = document.querySelector<HTMLElement>('[data-preview-night]');
        const backdrop = document.querySelector<HTMLElement>('[data-canvas-backdrop]');
        const opacity = (id: string) => {
          const el = document.querySelector<HTMLElement>(`[data-editor-widget="${id}"] [data-editor-content]`);
          return el ? Number(getComputedStyle(el).opacity) : null;
        };
        return {
          dark: dark ? { kind: dark.dataset.previewNight, opacity: Number(getComputedStyle(dark).opacity), bg: getComputedStyle(dark).backgroundColor, position: getComputedStyle(dark).position } : null,
          backdrop: backdrop ? { look: backdrop.dataset.canvasBackdrop, bg: getComputedStyle(backdrop).backgroundColor, sky: !!backdrop.querySelector('canvas'), w: backdrop.getBoundingClientRect().width, h: backdrop.getBoundingClientRect().height } : null,
          clock: opacity('clock'),
          tasks: opacity('tasks'),
          photoFrame: document.querySelectorAll('[data-canvas-photo-frame] [data-editor-widget]').length,
        };
      });

      // The toggles are always there, whichever panel is open, and start in use.
      await expect(page.locator('[data-canvas-pick="in-use"]')).toHaveAttribute('aria-pressed', 'true');

      // In use by day: the dashboard, all there, nothing over it.
      await canvasShows(page, 'in-use', 'day');
      await expect.poll(drawn).toMatchObject({ dark: null, backdrop: null, clock: 1, tasks: 1 });
      await expect(caption).toHaveText(new RegExp(`^Behind it e2e \\d+, in use, by day: the dashboard as someone using it sees it\\. ${size}\\.$`));

      // In use at night: still all there, and no darker (the wall dims only while idle).
      await canvasShows(page, 'night');
      await expect.poll(drawn).toMatchObject({ dark: null, backdrop: null, clock: 1, tasks: 1 });
      await expect(caption).toHaveText(/, in use, at night: the dashboard as someone using it sees it\./);

      // Idle by day: the dashboard, quieter: the clock stays, tasks fade.
      await canvasShows(page, 'idle', 'day');
      await expect.poll(drawn).toMatchObject({ dark: null, backdrop: null, clock: 1, tasks: 0.12 });
      await expect(caption).toHaveText(new RegExp(`, idle, by day: the dashboard, quieter\\. ${size}\\.$`));

      // Idle at night: the photo frame over the photo, half darker, at the screen's size.
      await canvasShows(page, 'night');
      await expect.poll(drawn).toMatchObject({
        dark: { kind: 'dim', opacity: 0.5, bg: 'rgb(0, 0, 0)', position: 'fixed' },
        backdrop: { look: 'photos', bg: 'rgb(0, 0, 0)' },
      });
      const night = await drawn();
      expect(night.photoFrame, 'the photo frame\'s arrangement is on the canvas').toBeGreaterThan(0);
      expect(night.backdrop!.w).toBe(Number(size.split(' x ')[0]));
      expect(night.backdrop!.h).toBe(Number(size.split(' x ')[1]));
      await expect(caption).toHaveText(new RegExp(`, idle, at night: a photo frame, 50% darker\\. ${size}\\.$`));

      // The night sky at night: the sky drawn, and darker too, as every look is on the wall.
      const sheet = page.locator('[data-editor-sheet="screen"]');
      await sheet.getByLabel('At night it shows').selectOption({ label: 'The night sky' });
      await expect.poll(drawn).toMatchObject({ dark: { kind: 'dim', opacity: 0.5 }, backdrop: { look: 'sky', sky: true } });
      await expect(caption).toHaveText(/, idle, at night: the night sky, 50% darker\./);

      // The dashboard at night, dimmed; and Screen off, black.
      await sheet.getByLabel('At night it shows').selectOption({ label: 'Same as by day' });
      await expect.poll(drawn).toMatchObject({ dark: { kind: 'dim', opacity: 0.5 }, backdrop: null, clock: 1, tasks: 0.12 });
      await sheet.getByLabel('At night it shows').selectOption({ label: 'Screen off' });
      await expect.poll(drawn).toMatchObject({ dark: { kind: 'off', opacity: 1 } });
      await expect(caption).toHaveText(/, idle, at night: screen off\./);

      // Back in use, by day: nothing over it again.
      await canvasShows(page, 'in-use', 'day');
      await expect.poll(drawn).toMatchObject({ dark: null, backdrop: null, tasks: 1 });
    } finally {
      await page.request.delete(`/api/layouts/${layout.id}`);
    }
  });

  test('offsets that cross near midsummer far north are refused', async ({ page }) => {
    const layout = await editIdle(page, { lat: 64, lon: -150 });
    try {
      await page.locator('[data-editor-sheet="screen"]').getByRole('button', { name: /^Advanced: when night is/ }).click();
      await page.getByLabel('Starts: unit').selectOption('hr');
      await page.getByLabel('Starts: amount').fill('6');
      await page.getByLabel('Ends: unit').selectOption('hr');
      await page.getByLabel('Ends: amount').fill('6');
      await expect(page.locator('[data-idle-crossed]')).toContainText('night would end before it starts');
      await expect(done(page)).toBeDisabled();
      expect(await storedDay(page)).toMatchObject({ day: 'dashboard', switch: { by: 'sun', duskOffset: 30, dawnOffset: -30 } });
    } finally {
      await page.request.delete(`/api/layouts/${layout.id}`);
    }
  });
});

/**
 * Dim when idle (#691): at night the idle screen darkens behind a black layer
 * that never takes a tap, and a touch lifts it. Night and how dark are the
 * screen's own (#1345), read on the screen's own clock, so the browser is put
 * in a zone west of UTC.
 */
test.describe('dim when idle', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database to create a dashboard');
  test.use({ viewport: { width: 1280, height: 720 }, timezoneId: 'America/Chicago' });
  // The editor loads the dashboard twice (the page and its frame), slow on a cold CI server.
  test.setTimeout(180_000);

  async function dim(page: Page) {
    return page.evaluate(() => {
      const layer = document.querySelector<HTMLElement>('[data-idle-dim]');
      if (!layer) return null;
      const at = document.elementFromPoint(640, 360);
      return { opacity: Number(getComputedStyle(layer).opacity), takesTaps: !!at && layer.contains(at) };
    });
  }

  /** A screen whose night runs 11 pm to 7 am, on a dashboard removed after the test. */
  async function withNightDashboard(page: Page, run: (slug: string, id: string) => Promise<void>, nightLevel: 0 | 50 = 0) {
    await verifySettingsPinViaAPI(page, (await getFirstParent(page)).name, PIN);
    await screenIdles(page, { day: 'photos', night: 'photos', switch: { by: 'clock', from: '23:00', to: '07:00' } }, nightLevel);
    const created = await page.request.post('/api/layouts', {
      data: {
        name: `Dim e2e ${Date.now()}`,
        widgets: [{ i: 'clock', x: 0, y: 0, w: 16, h: 12 }],
      },
    });
    expect(created.status()).toBe(201);
    const layout = await created.json();
    try {
      await run(layout.slug, layout.id);
    } finally {
      await page.request.delete(`/api/layouts/${layout.id}`);
    }
  }

  test('darkens the idle screen at night by the screen\'s rule, and a touch lifts it', async ({ page }) => {
    // 11:30 pm in Chicago, 04:30 UTC: inside 11 pm to 7 am only on the screen's clock.
    await page.clock.setFixedTime(new Date('2026-10-28T04:30:00Z'));
    await withNightDashboard(page, async (slug, id) => {
      // Darker at night is the screen's own, on its editor's Screen tab (#1159, #1326),
      // so this browser is a screen showing the dashboard (#1283).
      const { removeScreen } = await editAsScreen(page, id);
      try {
        await openSheet(page, 'screen');
        await page.locator('[data-editor-sheet="screen"]').getByLabel('Darker at night').selectOption({ label: '50%' });
        await done(page).click();
        // Done sends the screen its settings and leaves the editor; let it land first.
        await page.waitForURL((u) => !u.pathname.startsWith('/screens/'), { timeout: 60_000 });
        await page.waitForLoadState('load');

        await page.goto(`/d/${slug}`);
        await waitForQuiet(page);
        expect(await dim(page), 'awake, nothing is dimmed').toEqual({ opacity: 0, takesTaps: false });

        await page.evaluate(() => window.dispatchEvent(new Event('prism:screensaver')));
        // It eases in over 4 s.
        await page.waitForTimeout(5000);
        expect(await dim(page), 'idle at night: half dark, taps pass through').toEqual({ opacity: 0.5, takesTaps: false });

        // The first touch after the toolbar's forced start is absorbed; the second wakes.
        for (let n = 0; n < 2; n++) await page.mouse.click(640, 360);
        await page.waitForTimeout(1000);
        expect((await dim(page))!.opacity, 'awake again, full brightness').toBe(0);
      } finally {
        await removeScreen();
      }
    });
  });

  test('leaves the idle screen alone by day', async ({ page }) => {
    // 6 pm in Chicago, which is 11 pm UTC: night must not be read in UTC.
    await page.clock.setFixedTime(new Date('2026-10-28T23:00:00Z'));
    await withNightDashboard(page, async (slug) => {
      await page.goto(`/d/${slug}`);
      await waitForQuiet(page);
      await page.evaluate(() => window.dispatchEvent(new Event('prism:screensaver')));
      await page.waitForTimeout(5000);
      expect((await dim(page))!.opacity).toBe(0);
    }, 50);
  });
});

test.describe('screensaver widget outlines', () => {
  test.use({ viewport: { width: 1280, height: 720 } });
  test.setTimeout(90_000);

  /** Alpha of each screensaver card's top border, by widget. */
  async function outlineAlpha(page: Page): Promise<number[]> {
    return page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.prism-screensaver-flat')].map((live) => {
        const card = live.querySelector<HTMLElement>('[class*="bg-card"].border-border');
        if (!card) return -1;
        const c = getComputedStyle(card).borderTopColor;
        if (c === 'transparent') return 0;
        const slash = c.match(/\/\s*([\d.]+)\s*\)$/);
        if (slash) return Number(slash[1]);
        const rgba = c.match(/^rgba\((?:[^,]+,){3}\s*([\d.]+)\)$/);
        return rgba ? Number(rgba[1]) : 1;
      }));
  }

  test('a widget about to burst sets its outline down first, with outlines shown', async ({ page }) => {
    // Outlines on is the default, and it was the case that broke: the outline
    // colour is a Tailwind utility in a cascade layer, and an unlayered
    // !important rule loses to it, so the outline stayed through the wind-up
    // and vanished all at once at the burst.
    await page.addInitScript(() => localStorage.setItem('prism-screensaver-outlines', 'on'));
    await page.goto('/');
    await waitForQuiet(page);
    await page.evaluate(() => window.dispatchEvent(new Event('prism:screensaver')));
    await page.locator('.fixed.inset-0.z-9999 .prism-screensaver-flat').first().waitFor();
    await page.waitForTimeout(1000);

    const before = await outlineAlpha(page);
    const target = before.findIndex((a) => a > 0);
    expect(target, 'precondition: a screensaver card shows an outline').toBeGreaterThanOrEqual(0);

    // What WidgetStage puts on a departing widget the moment its wind-up starts.
    await page.evaluate((i) => {
      document.querySelectorAll('.prism-screensaver-flat')[i]!.classList.add('prism-shed');
    }, target);
    // The shed fades over 2.8 s; the wind-up before the burst is longer.
    await page.waitForTimeout(3500);

    const after = await outlineAlpha(page);
    expect(after[target], 'the outline is gone before the burst').toBe(0);
  });

  test('a widget with Outline set to None has no outline, with outlines shown', async ({ page }) => {
    // Outlines on is the default and the hard case: their colour is a Tailwind
    // !important utility in a cascade layer, which beats any unlayered rule.
    await page.addInitScript(() => {
      localStorage.setItem('prism-screensaver-outlines', 'on');
      localStorage.setItem('prism-screensaver-motion', 'off');
      localStorage.setItem('prism-screensaver-motion-v2', '1');
      localStorage.setItem('prism-screensaver-drift', 'off');
    });
    await arrangedAs(page, [
      { i: 'clock', x: 2, y: 2, w: 16, h: 10, visible: true, outlineColor: 'transparent' },
      { i: 'weather', x: 20, y: 2, w: 16, h: 10, visible: true },
      { i: 'messages', x: 2, y: 14, w: 16, h: 10, visible: false },
    ]);
    await page.goto('/');
    await waitForQuiet(page);
    await page.evaluate(() => window.dispatchEvent(new Event('prism:screensaver')));
    await page.locator('.fixed.inset-0.z-9999 .widget-cell[data-widget="clock"]').waitFor();
    await page.waitForTimeout(1000);

    const alpha = await page.evaluate(() => {
      const out: Record<string, number> = {};
      for (const id of ['clock', 'weather']) {
        const card = document.querySelector<HTMLElement>(
          `.fixed.inset-0 .widget-cell[data-widget="${id}"] [class*="bg-card"].border-border`);
        if (!card) { out[id] = -1; continue; }
        const c = getComputedStyle(card).borderTopColor;
        const slash = c.match(/\/\s*([\d.]+)\s*\)$/);
        const rgba = c.match(/^rgba\((?:[^,]+,){3}\s*([\d.]+)\)$/);
        out[id] = c === 'transparent' ? 0 : slash ? Number(slash[1]) : rgba ? Number(rgba[1]) : 1;
      }
      return out;
    });
    expect(alpha.weather, 'precondition: a default widget shows its outline').toBeGreaterThan(0);
    expect(alpha.clock, 'Outline: None hides the card outline').toBe(0);
  });

  test('an empty widget is hidden by default and keeps its place, unless set to show', async ({ page }) => {
    // #738: on the screensaver an empty widget hides unless set otherwise.
    // Messages is made empty by answering its fetch with nothing.
    await page.route('**/api/messages?*', (route) => route.fulfill({ json: { messages: [] } }));
    const open = async (messages: Record<string, unknown>) => {
      await page.addInitScript(() => {
        localStorage.setItem('prism-screensaver-motion', 'off');
        localStorage.setItem('prism-screensaver-motion-v2', '1');
        localStorage.setItem('prism-screensaver-drift', 'off');
      });
      await arrangedAs(page, [
        { i: 'clock', x: 2, y: 2, w: 16, h: 10, visible: true },
        { i: 'messages', x: 20, y: 2, w: 16, h: 10, visible: true, ...messages },
        { i: 'weather', x: 2, y: 14, w: 16, h: 10, visible: false },
      ]);
      await page.goto('/');
      await waitForQuiet(page);
      await page.evaluate(() => window.dispatchEvent(new Event('prism:screensaver')));
      await page.locator('.fixed.inset-0.z-9999 .widget-cell[data-widget="messages"]').waitFor();
      await page.waitForTimeout(1500);
      return page.evaluate(() => {
        const cell = (id: string) => {
          const el = document.querySelector<HTMLElement>(`.fixed.inset-0 .widget-cell[data-widget="${id}"]`)!;
          return { opacity: Number(getComputedStyle(el).opacity), w: el.getBoundingClientRect().width };
        };
        return { clock: cell('clock'), messages: cell('messages') };
      });
    };

    const byDefault = await open({});
    expect(byDefault.clock.opacity, 'the clock always shows').toBe(1);
    expect(byDefault.messages.opacity, 'empty messages are hidden').toBe(0);
    expect(byDefault.messages.w, 'and keep their place').toBeGreaterThan(0);

    const shown = await open({ hideWhenEmpty: false });
    expect(shown.messages.opacity, 'set to always show, it shows').toBe(1);
  });

  test('drifting widgets keep their gaps through a whole cycle, with nothing stored', async ({ page }) => {
    // Drift is on by default. It used to run each widget on its own phase, so
    // neighbours could drift towards each other and overlap (-14.8 px measured
    // on the wall's 4 px gaps). Waiting for the worst moment takes minutes, so
    // this pauses the drift animations and steps them through one whole cycle,
    // keeping whatever phases the page gave them.
    await page.addInitScript(() => localStorage.setItem('prism-perf-mode', 'false'));
    await page.goto('/');
    await waitForQuiet(page);
    await page.evaluate(() => window.dispatchEvent(new Event('prism:screensaver')));
    await page.locator('.fixed.inset-0.z-9999 .widget-cell').first().waitFor();
    await page.waitForTimeout(1500);

    const result = await page.evaluate(() => {
      const cells = [...document.querySelectorAll<HTMLElement>('.fixed.inset-0.z-9999 .widget-cell')];
      const gap = parseFloat(getComputedStyle(cells[0]!.parentElement!).columnGap);
      const drifts = cells.flatMap((c) => c.getAnimations()).filter(
        (a) => a instanceof CSSAnimation && a.animationName === 'prism-drift');
      drifts.forEach((a) => a.pause());
      const period = 96_000;
      let closest = Infinity;
      let reach = 0;
      for (let t = 0; t < period; t += 1000) {
        const rects = cells.map((c) => c.getBoundingClientRect());
        // How far each cell is from its own place in the grid.
        for (const c of cells) {
          const m = new DOMMatrix(getComputedStyle(c).transform);
          reach = Math.max(reach, Math.hypot(m.e, m.f));
        }
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            const a = rects[i]!, b = rects[j]!;
            // Distance between the two boxes; negative when they overlap.
            const apart = Math.max(a.left - b.right, b.left - a.right, a.top - b.bottom, b.top - a.bottom);
            closest = Math.min(closest, apart);
          }
        }
        drifts.forEach((a) => { a.currentTime = Number(a.currentTime) + 1000; });
      }
      return { cells: cells.length, drifts: drifts.length, gap, closest, reach };
    });

    expect(result.cells, 'precondition: the screensaver shows two widgets or more').toBeGreaterThan(1);
    expect(result.drifts, 'every widget drifts with nothing stored').toBe(result.cells);
    expect(result.reach, 'the widgets move').toBeGreaterThan(3.5);
    expect(result.reach, 'within the 4 px figure eight').toBeLessThanOrEqual(4.5);
    expect(result.closest, 'neighbours never get closer than the grid gap').toBeGreaterThanOrEqual(result.gap - 0.5);
  });

  test('a drifting widget moves whole, with no edge clipped by its cell', async ({ page }) => {
    // Drift used to run inside the cell, which clips its content, so the card
    // lost the edge of its outline on whichever side it had drifted towards.
    // A lighter performance level stops animations; pin Full.
    await page.addInitScript(() => localStorage.setItem('prism-perf-mode', 'false'));
    await page.goto('/');
    await waitForQuiet(page);
    await page.evaluate(() => window.dispatchEvent(new Event('prism:screensaver')));
    await page.locator('.fixed.inset-0.z-9999 .widget-cell').first().waitFor();

    const measure = () => page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.fixed.inset-0.z-9999 .widget-cell')].map((cell) => {
        const c = cell.getBoundingClientRect();
        const card = cell.querySelector('.border-border[class*="bg-card/"]');
        const k = card?.getBoundingClientRect();
        return {
          id: cell.dataset.widget!, x: c.x, y: c.y,
          // How far the card reaches past its cell on any side; the cell clips there.
          overhang: k ? Math.max(c.left - k.left, c.top - k.top, k.right - c.right, k.bottom - c.bottom) : 0,
        };
      }));

    await page.waitForTimeout(1500);
    const first = await measure();
    await page.waitForTimeout(2000);
    const second = await measure();
    expect(first.length, 'precondition: the screensaver shows widgets').toBeGreaterThan(0);
    for (const m of [...first, ...second]) {
      expect(m.overhang, `${m.id} is not clipped by its cell`).toBeLessThanOrEqual(0.5);
    }
    const moved = first.some((m, n) => Math.hypot(m.x - second[n]!.x, m.y - second[n]!.y) > 0.2);
    expect(moved, 'the drift is still running').toBe(true);
  });
});


/**
 * The clock and weather as small tiles in the top corners (#905). A new
 * install's Home layout puts them there, the photo between them, so the idle
 * screen shows the time and weather on the photo's corners. In a small tile
 * the weather shows icon, temperature and condition on one line each, and the
 * details only once the tile has room; a corner tile's text lines up with the
 * screen edge it touches.
 */
test.describe('corner clock and weather', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database to log in and create a dashboard');
  test.use({ viewport: { width: 1920, height: 1080 } });
  test.setTimeout(90_000);

  const day = new Date();
  const at = (h: number, m: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m).toISOString();
  /** A fixed /api/weather response, so the test needs no weather provider. */
  const WEATHER = {
    location: 'Springfield',
    current: { temperature: 76, feelsLike: 75, condition: 'partly-cloudy', humidity: 48, windSpeed: 8, description: 'Partly Cloudy' },
    forecast: [],
    hourly: [],
    sunrise: at(5, 14),
    sunset: at(20, 28),
    moonPhase: 0.1,
    moonPhaseName: 'Waxing Crescent',
    units: { temperature: 'F', windSpeed: 'mph', precipitation: 'in' },
    lastUpdated: day.toISOString(),
  };

  async function openLayout(page: Page, widgets: unknown[], weather: object = WEATHER) {
    const login = await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } });
    expect(login.ok(), 'precondition: login must succeed').toBe(true);
    const created = await page.request.post('/api/layouts', { data: { name: `Corners e2e ${Date.now()}`, widgets } });
    expect(created.status()).toBe(201);
    const layout = await created.json();
    await page.route('**/api/weather*', (route) => route.fulfill({ json: weather }));
    await page.goto(`/d/${layout.slug}`);
    await page.locator('[data-weather-current]').waitFor({ timeout: 60000 });
    await page.locator('[data-clock-time]').waitFor();
    await page.waitForTimeout(800);
    return layout as { id: string };
  }

  type Rect = { left: number; right: number; top: number; bottom: number; width: number; height: number };
  const rect = (page: Page, selector: string): Promise<Rect> => page.locator(selector).first().evaluate((el) => {
    const b = el.getBoundingClientRect();
    return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width, height: b.height };
  });

  test('Home puts a compact clock and weather in the top corners', async ({ page }) => {
    const layout = await openLayout(page, FIRST_SCREEN_TEMPLATE.widgets);
    try {
      const clock = await rect(page, '.widget-cell[data-widget="clock"]');
      const weather = await rect(page, '.widget-cell[data-widget="weather"]');
      const calendar = await rect(page, '.widget-cell[data-widget="calendar"]');

      // The tiles sit on the grid's top corners: the calendar spans the grid
      // below them, so its edges are the grid's edges.
      expect(Math.abs(clock.left - calendar.left), 'clock on the left edge').toBeLessThanOrEqual(1);
      expect(Math.abs(weather.right - calendar.right), 'weather on the right edge').toBeLessThanOrEqual(1);
      expect(Math.abs(clock.top - weather.top), 'one top line').toBeLessThanOrEqual(1);
      expect(clock.bottom, 'both above the calendar').toBeLessThan(calendar.top);
      // Compact: each about a quarter of the width, with the photo between.
      expect(clock.width).toBeLessThan(calendar.width / 3);
      expect(weather.width).toBeLessThan(calendar.width / 3);
      expect(weather.left - clock.right, 'photo between them').toBeGreaterThan(calendar.width / 3);

      // The clock's time lines up with the left edge rather than centring.
      const time = await rect(page, '.widget-cell[data-widget="clock"] [data-clock-time]');
      expect(time.left - clock.left, 'time hugs the left edge').toBeLessThan(40);

      // The weather shows icon, temperature and condition, nothing else, lined
      // up with the right edge and the top, like the clock (#988).
      await expect(page.locator('[data-weather-details]')).toBeHidden();
      const current = await rect(page, '[data-weather-current]');
      const condition = page.locator('[data-weather-condition]');
      await expect(condition).toHaveText('Partly Cloudy');
      const cond = await condition.evaluate((el) => ({
        lines: Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)),
        cut: el.scrollWidth > el.clientWidth,
      }));
      expect(cond.lines, 'condition on one line').toBe(1);
      expect(cond.cut, 'condition not cut off').toBe(false);
      const temp = await rect(page, '[data-weather-current] .text-4xl');
      expect(weather.right - temp.right, 'weather hugs the right edge').toBeLessThan(40);
      expect(current.top - weather.top, 'weather hugs the top of its tile').toBeLessThan(24);
      expect(time.top - clock.top, 'the clock hugs the top of its tile too').toBeLessThan(40);
    } finally {
      await page.request.delete(`/api/layouts/${layout.id}`);
    }
  });

  // #800: the clock and the temperature in the display face, the weather as
  // one line with the day's high, at the wall size and the small tablet's.
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 800 }]) {
    test(`the corners use the display face and read as one line at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const today = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}T00:00:00.000Z`;
      const layout = await openLayout(page, FIRST_SCREEN_TEMPLATE.widgets, {
        ...WEATHER,
        forecast: [{ date: today, dayName: 'Today', high: 79, low: 61, condition: 'partly-cloudy' }],
      });
      try {
        const faces = await page.evaluate(() => {
          const look = (sel: string) => {
            const el = document.querySelector(sel) as HTMLElement;
            const cs = getComputedStyle(el);
            return { family: cs.fontFamily, size: parseFloat(cs.fontSize) };
          };
          // The page's own floor: 14px on a touch wall, 12px with a mouse.
          const probe = document.createElement('div');
          probe.style.fontSize = 'var(--text-floor)';
          document.body.appendChild(probe);
          const floor = parseFloat(getComputedStyle(probe).fontSize);
          probe.remove();
          return {
            floor,
            time: look('.widget-cell[data-widget="clock"] [data-clock-time]'),
            date: look('.widget-cell[data-widget="clock"] [data-clock-date]'),
            temp: look('[data-weather-temp]'),
            condition: look('[data-weather-condition]'),
          };
        });
        // The display face is a next/font family; its generated name contains
        // the face's name, and the text face's does not.
        expect(faces.time.family, 'clock in the display face').toMatch(/Literata/i);
        expect(faces.temp.family, 'temperature in the display face').toMatch(/Literata/i);
        expect(faces.condition.family, 'condition in the text face').not.toMatch(/Literata/i);
        const { floor, ...text } = faces;
        expect(floor).toBeGreaterThanOrEqual(12);
        for (const [name, f] of Object.entries(text)) {
          expect(f.size, `${name} at or above the text floor`).toBeGreaterThanOrEqual(floor - 0.01);
        }
        const condition = page.locator('[data-weather-condition]');
        await expect(condition).toHaveText('Partly Cloudy, high 79°F');
        const cut = await condition.evaluate((el) => el.scrollWidth > el.clientWidth);
        expect(cut, 'the weather line is not cut off').toBe(false);
      } finally {
        await page.request.delete(`/api/layouts/${layout.id}`);
      }
    });
  }

  // #799: on a wallpaper the corner tiles sit straight on the photo in the
  // light ink, and other glass cards are water, thin and only lightly blurred.
  test('on a photo the corners have no card and the other cards are water', async ({ page }) => {
    await page.route('**/api/photos?*', (route) => route.fulfill({ json: { photos: [], total: 0 } }));
    await page.route('**/api/settings', async (route) => {
      const res = await route.fetch();
      const json = await res.json();
      json.settings = { ...(json.settings ?? {}), wallpaperScenery: true };
      await route.fulfill({ response: res, json });
    });
    const layout = await openLayout(page, FIRST_SCREEN_TEMPLATE.widgets);
    try {
      await expect(page.locator('html')).toHaveAttribute('data-wallpaper', 'scenery');
      // The photo has been read, so the water values are this photo's, not the fallback.
      await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--ds-water-alpha'))).not.toBe('');
      const look = await page.evaluate(() => {
        const cell = (id: string) => getComputedStyle(document.querySelector(`.widget-cell[data-widget="${id}"]`)!);
        const alpha = (c: string) => { const m = /rgba?\(([^)]+)\)/.exec(c); const p = m ? m[1]!.split(/[ ,/]+/).filter(Boolean) : []; return p.length > 3 ? Number(p[3]) : 1; };
        const time = getComputedStyle(document.querySelector('.widget-cell[data-widget="clock"] [data-clock-time]')!);
        return {
          clockBg: alpha(cell('clock').backgroundColor),
          clockBlur: cell('clock').backdropFilter,
          weatherBg: alpha(cell('weather').backgroundColor),
          timeColor: time.color,
          calendarBg: alpha(cell('calendar').backgroundColor),
          calendarBlur: cell('calendar').backdropFilter,
          shade: !!document.querySelector('[data-wallpaper-shade]'),
        };
      });
      expect(look.clockBg, 'clock has no card').toBe(0);
      expect(look.weatherBg, 'weather has no card').toBe(0);
      expect(look.clockBlur).toBe('none');
      expect(look.timeColor, 'clock in the light ink').toBe('rgb(255, 255, 255)');
      expect(look.calendarBg, 'water is thinner than the old glass').toBeLessThanOrEqual(0.6);
      expect(look.calendarBg).toBeGreaterThanOrEqual(0.18);
      expect(look.calendarBlur, 'a little blur, not the old 24px').toContain('blur(10px)');
      expect(look.shade, 'shade under the text').toBe(true);
    } finally {
      await page.request.delete(`/api/layouts/${layout.id}`);
    }
  });

  test('a large weather tile keeps its details, each on one line', async ({ page }) => {
    const layout = await openLayout(page, [
      { i: 'weather', x: 0, y: 0, w: 24, h: 16 },
      { i: 'clock', x: 24, y: 0, w: 24, h: 8 },
    ]);
    try {
      await expect(page.locator('[data-weather-details]')).toBeVisible();
      const cell = await rect(page, '.widget-cell[data-widget="weather"]');
      const pill = page.locator('[data-testid="header-sun-times"]');
      const sun = await pill.evaluate((el) => ({
        lines: Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)),
        cut: el.scrollWidth > el.clientWidth,
        right: el.getBoundingClientRect().right,
      }));
      expect(sun.lines, 'sunrise and sunset on one line').toBe(1);
      expect(sun.cut, 'sun times not cut off').toBe(false);
      expect(sun.right).toBeLessThanOrEqual(cell.right);
      // Not a corner tile (half the width), so the clock stays centred.
      const clock = await rect(page, '.widget-cell[data-widget="clock"]');
      const time = await rect(page, '.widget-cell[data-widget="clock"] [data-clock-time]');
      expect(Math.abs((time.left + time.right) / 2 - (clock.left + clock.right) / 2)).toBeLessThan(8);
    } finally {
      await page.request.delete(`/api/layouts/${layout.id}`);
    }
  });
});

test.describe('editor keys (#987)', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database to log in and edit');
  test.use({ viewport: { width: 1280, height: 720 } });
  // The editor loads the dashboard twice (the page and its frame), slow on a cold CI server.
  test.setTimeout(180_000);

  test('Delete removes the selected widget with Undo; arrows move it, and resize it in resize mode', async ({ page }) => {
    // On the canvas (#1283): a click puts the keys in the frame, where the editor runs.
    const canvas = await openScreensaverEditor(page, 'landscape');
    const clock = canvas.locator('[data-editor-widget="clock"]');
    const box = async () => (await boxes(canvas, '[data-editor-widget]')).clock!;
    const near = (a: number, b: number) => Math.abs(a - b) <= 2;

    // Select (move mode): an arrow moves it one cell, keeping its size.
    await clock.click();
    const start = await box();
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await box()).x).toBeGreaterThan(start.x + 4);
    const moved = await box();
    expect(near(moved.w, start.w) && near(moved.h, start.h), 'a move keeps the size').toBe(true);
    const cell = moved.x - start.x;
    await page.keyboard.press('ArrowLeft');
    await expect.poll(async () => (await box()).x).toBeLessThan(moved.x - 4);

    // From its settings in the Widgets panel (#1323), on the editor page and
    // not in the frame, the keys still reach it, as they did from the strip
    // that sat over the canvas.
    const glass = page.locator('[data-editor-sheet="widgets"] [data-widget-settings="clock"]').getByLabel('Glass fill');
    await glass.focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await box()).x).toBeGreaterThan(start.x + 4);
    await page.keyboard.press('ArrowLeft');
    await expect.poll(async () => (await box()).x).toBeLessThan(start.x + 4);

    // Second tap: resize mode. Down grows it a cell, left shrinks it a cell.
    await clock.click();
    const before = await box();
    await page.keyboard.press('ArrowDown');
    await expect.poll(async () => (await box()).h).toBeGreaterThan(before.h + 4);
    await page.keyboard.press('ArrowLeft');
    await expect.poll(async () => (await box()).w).toBeLessThan(before.w - 4);
    const resized = await box();
    expect(near(resized.x, before.x) && near(resized.y, before.y), 'a resize keeps the top-left corner').toBe(true);
    expect(Math.abs((before.w - resized.w) - cell) <= 2, 'one cell narrower').toBe(true);

    // Typing in a field does nothing to the layout.
    await canvas.locator('body').evaluate(() => { const i = document.createElement('input'); i.id = 'typing-probe'; document.body.appendChild(i); });
    await canvas.locator('#typing-probe').focus();
    await page.keyboard.press('Backspace');
    await page.keyboard.press('ArrowRight');
    await expect(clock).toBeVisible();
    expect(near((await box()).x, resized.x), 'arrows in a field leave the widget').toBe(true);
    await canvas.locator('body').evaluate(() => document.getElementById('typing-probe')?.remove());

    // Still selected: Delete removes it; Undo brings it back.
    await page.keyboard.press('Delete');
    await expect(clock).toHaveCount(0);
    await canvas.getByRole('listitem').filter({ hasText: 'Widget removed.' }).getByRole('button', { name: 'Undo' }).click();
    await expect(clock).toBeVisible();
  });
});

/**
 * The upgrade from v1.30.1 (#1154). v1.30.1 kept one screensaver arrangement
 * in each browser, and a dashboard with none of its own showed it over
 * photos. The upgrade (0036, 0039) leaves such a dashboard resting over
 * photos with no arrangement, and once any other dashboard has one, the
 * default would show instead. The browser carries its arrangement onto the
 * dashboard it shows, so resting and night look as they did.
 */
test.describe('the upgrade from v1.30.1', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database to log in and create dashboards');
  test.use({ viewport: { width: 1280, height: 720 } });
  test.setTimeout(120_000);

  // Shopping and the clock, where the default has the clock, weather and messages.
  const KEPT = [
    { i: 'clock', x: 2, y: 2, w: 16, h: 10, visible: true },
    { i: 'shopping', x: 24, y: 4, w: 14, h: 14, visible: true },
    { i: 'messages', x: 32, y: 16, w: 16, h: 12, visible: false },
    { i: 'weather', x: 32, y: 28, w: 16, h: 8, visible: false },
  ];
  const OTHER = [{ i: 'weather', x: 0, y: 0, w: 16, h: 8, visible: true }];

  async function resting(page: Page, slug: string, at: string) {
    await page.clock.setFixedTime(new Date(at));
    await page.goto(`/d/${slug}`);
    await page.locator('.widget-cell[data-widget]').first().waitFor({ timeout: 60000 });
    await waitForQuiet(page);
    await page.evaluate(() => window.dispatchEvent(new Event('prism:screensaver')));
    await page.locator('.fixed.inset-0.z-9999 .widget-cell[data-widget]').first().waitFor();
    await page.waitForTimeout(1500);
    return page.evaluate(() => {
      const out: Record<string, { x: number; y: number; w: number; h: number }> = {};
      document.querySelectorAll<HTMLElement>('.fixed.inset-0.z-9999 .widget-cell[data-widget]').forEach((el) => {
        const b = el.getBoundingClientRect();
        out[el.dataset.widget!] = { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
      });
      return {
        widgets: out,
        sky: !!document.querySelector('[data-testid="night-sky"]'),
        night: !!document.querySelector('[data-screensaver-night]'),
        dim: (() => { const d = document.querySelector('[data-idle-dim]'); return d ? Number(getComputedStyle(d).opacity) : 0; })(),
      };
    });
  }

  test('a dashboard with no screensaver of its own rests, by day and at night, with the one this browser kept, and keeps it', async ({ page }) => {
    const login = await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } });
    expect(login.ok(), 'precondition: login must succeed').toBe(true);
    const stamp = Date.now();
    // Both as the upgrade leaves a v1.30.1 dashboard: over photos, one with
    // an arrangement saved in the editor, one never saved.
    const saved = await (await page.request.post('/api/layouts', {
      data: { name: `Upgrade saved ${stamp}`, widgets: FIRST_SCREEN_TEMPLATE.widgets, screensaverWidgets: OTHER, idleBackground: { source: 'photos' } },
    })).json();
    const plain = await (await page.request.post('/api/layouts', {
      data: { name: `Upgrade plain ${stamp}`, widgets: FIRST_SCREEN_TEMPLATE.widgets, idleBackground: { source: 'photos' } },
    })).json();
    expect(plain.screensaverWidgets, 'precondition: no arrangement of its own').toBeNull();

    await weatherAt(page, { lat: 45, lon: -100 });
    await page.addInitScript((kept) => {
      // Once per test: what a v1.30.1 browser holds. Drift is stilled only to measure.
      if (sessionStorage.getItem('upgrade-seeded')) return;
      localStorage.removeItem('prism-screensaver-carried');
      localStorage.setItem('prism-screensaver-layout', JSON.stringify(kept));
      localStorage.setItem('prism-screensaver-drift', 'off');
      localStorage.setItem('prism-perf-mode', 'false');
      sessionStorage.setItem('upgrade-seeded', '1');
    }, KEPT);

    try {
      const day = await resting(page, plain.slug, NOON);
      expect(Object.keys(day.widgets).sort(), 'by day: the arrangement this browser kept').toEqual(['clock', 'shopping']);
      expect(day.sky).toBe(false);

      // Carried onto the dashboard, so the phone editor and every screen see it.
      const carried = async () => ((await (await page.request.get(`/api/layouts/${plain.id}`)).json()).screensaverWidgets ?? [])
        .filter((w: { visible?: boolean }) => w.visible).map((w: { i: string }) => w.i).sort();
      await expect.poll(carried).toEqual(['clock', 'shopping']);
      expect(await page.evaluate(() => localStorage.getItem('prism-screensaver-carried'))).toBe('1');

      // At night the same widgets in the same places, over photos, not dimmed.
      const night = await resting(page, plain.slug, NIGHT);
      expect(day.night, 'precondition: noon is day').toBe(false);
      expect(night.night, 'precondition: it is night by the dashboard\'s rule').toBe(true);
      expect(night.widgets, 'night: unchanged from the day').toEqual(day.widgets);
      expect(night.sky, 'night: still photos').toBe(false);
      expect(night.dim, 'night: no dimming').toBe(0);

      // A carry-over never replaces an arrangement already saved.
      const again = await page.request.patch(`/api/layouts/${saved.id}`, { data: { screensaverWidgets: KEPT, carryOver: true } });
      expect(again.ok()).toBe(true);
      expect((await again.json()).screensaverWidgets).toEqual(OTHER);
    } finally {
      await page.request.delete(`/api/layouts/${saved.id}`);
      await page.request.delete(`/api/layouts/${plain.id}`);
    }
  });
});
