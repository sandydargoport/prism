import { test, expect, type Page } from '@playwright/test';
import { getSeededParentId } from './helpers/auth';
import {
  facingFor, localSiderealTime, project, toHorizontal,
} from '../src/components/screensaver/nightSky/sky';
import { FIGURES } from '../src/components/screensaver/nightSky/catalog';

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
    // Drift is on by default and would move the live widgets off their places.
    localStorage.setItem('prism-screensaver-drift', 'off');
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

test.describe('screensaver night sky', () => {
  test.use({ viewport: { width: 1280, height: 720 } });
  test.setTimeout(90_000);

  async function openScreensaver(page: Page, backdrop: string, at: string) {
    await page.clock.setFixedTime(new Date(at));
    await page.route('**/api/weather*', async (route) => {
      const response = await route.fetch();
      if (!response.ok()) return route.fulfill({ response });
      return route.fulfill({ response, json: { ...(await response.json()), lat: 45, lon: -100 } });
    });
    await page.addInitScript((value) => {
      localStorage.setItem('prism-screensaver-backdrop', value);
      // Performance Mode turns itself on with four cores or fewer, which a CI
      // runner has, and it stops the twinkle and shooting stars on purpose.
      localStorage.setItem('prism-perf-mode', 'false');
    }, backdrop);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => window.dispatchEvent(new Event('prism:screensaver')));
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

  test('after dark shows photos at noon and the sky at midnight', async ({ page }) => {
    await openScreensaver(page, 'skyAtNight', NOON);
    expect(await sky(page), 'local noon: photos, no sky').toBeNull();

    await page.clock.setFixedTime(new Date(NIGHT));
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => window.dispatchEvent(new Event('prism:screensaver')));
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
  test.setTimeout(90_000);

  // Clock and Tasks rely on the default ticks; Shopping and Weather override them.
  const WIDGETS = [
    { i: 'clock', x: 0, y: 0, w: 16, h: 12 },
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
    expect(layout.screensaverMode).toBe('calm');

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

      await page.evaluate(() => window.dispatchEvent(new Event('prism:screensaver')));
      await page.waitForTimeout(1500);
      const idle = await cells(page);

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
      for (const i of [...SHOWN, ...FADED]) {
        expect(awake[i]!.opacity, `${i} is back`).toBe(1);
        expect(off(i, before, awake), `${i} is back in its place`).toBeLessThanOrEqual(1);
      }
    } finally {
      await page.request.delete(`/api/layouts/${layout.id}`);
    }
  });

  test('each widget\'s Stays / Fades button in the editor sets whether it stays', async ({ page }) => {
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
      await page.getByLabel('Edit layout').click({ timeout: 60000 });
      const toggle = (i: string) => page.locator(`[data-editor-widget="${i}"] [data-idle-toggle]`);
      await expect(toggle('clock')).toHaveAttribute('aria-pressed', 'true');
      await expect(toggle('clock')).toContainText('Stays');
      await expect(toggle('tasks')).toHaveAttribute('aria-pressed', 'false');
      await expect(toggle('tasks')).toContainText('Fades');

      await toggle('tasks').click();
      await toggle('clock').click();
      await expect(toggle('tasks')).toHaveAttribute('aria-pressed', 'true');
      await expect(toggle('clock')).toHaveAttribute('aria-pressed', 'false');
      // The button changes only this; it does not select the widget to move it.
      await expect(page.getByText(/^Tap to (resize|deselect)$/)).toHaveCount(0);

      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.locator('[data-idle-toggle]')).toHaveCount(0);
      const saved = await (await page.request.get(`/api/layouts/${layout.id}`)).json();
      const tick = Object.fromEntries(saved.widgets.map((w: { i: string; showWhenIdle?: boolean }) => [w.i, w.showWhenIdle]));
      expect(tick).toEqual({ clock: false, tasks: true });

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
    await page.waitForLoadState('networkidle');
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

  test('drifting widgets keep their gaps through a whole cycle, with nothing stored', async ({ page }) => {
    // Drift is on by default. It used to run each widget on its own phase, so
    // neighbours could drift towards each other and overlap (-14.8 px measured
    // on the wall's 4 px gaps). Waiting for the worst moment takes minutes, so
    // this pauses the drift animations and steps them through one whole cycle,
    // keeping whatever phases the page gave them.
    await page.addInitScript(() => localStorage.setItem('prism-perf-mode', 'false'));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
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
    // Performance Mode stops animations, and a CI runner trips it.
    await page.addInitScript(() => localStorage.setItem('prism-perf-mode', 'false'));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
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
