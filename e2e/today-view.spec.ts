import { test, expect, type Page } from '@playwright/test';
import { getSeededParentId } from './helpers/auth';
import { TODAY_TEMPLATE } from '../src/lib/constants/layoutTemplates';

/**
 * Today (#907): a dashboard drawn as one scene over the photo instead of the
 * widget grid. Needs the seeded test database to log in and create layouts.
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const PIN = process.env.E2E_PIN || '1234';

test.describe('the Today view', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database to log in and create a dashboard');
  test.setTimeout(90_000);

  const day = new Date();
  const WEATHER = {
    location: 'Springfield',
    current: { temperature: 76, feelsLike: 75, condition: 'partly-cloudy', humidity: 48, windSpeed: 8, description: 'Partly Cloudy' },
    forecast: [{ date: day.toISOString(), dayName: 'Today', high: 79, low: 61, condition: 'partly-cloudy' }],
    hourly: [],
    units: { temperature: 'F', windSpeed: 'mph', precipitation: 'in' },
    lastUpdated: day.toISOString(),
  };

  async function login(page: Page) {
    const res = await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } });
    expect(res.ok(), 'precondition: login must succeed').toBe(true);
  }

  test('the layouts API keeps the view: Today when asked, the grid otherwise', async ({ page }) => {
    await login(page);
    const made: string[] = [];
    try {
      const today = await page.request.post('/api/layouts', { data: { name: `Today api ${Date.now()}`, widgets: TODAY_TEMPLATE.widgets, view: 'today' } });
      expect(today.status()).toBe(201);
      const t = await today.json(); made.push(t.id);
      expect(t.view).toBe('today');

      const grid = await page.request.post('/api/layouts', { data: { name: `Grid api ${Date.now()}`, widgets: TODAY_TEMPLATE.widgets } });
      const g = await grid.json(); made.push(g.id);
      expect(g.view, 'a new dashboard is a grid by default').toBe('grid');

      // A rename leaves the view alone; an unknown view is refused.
      const renamed = await page.request.patch(`/api/layouts/${t.id}`, { data: { name: 'Renamed Today' } });
      expect((await renamed.json()).view).toBe('today');
      const bad = await page.request.patch(`/api/layouts/${t.id}`, { data: { view: 'freeform' } });
      expect(bad.status()).toBe(400);
    } finally {
      for (const id of made) await page.request.delete(`/api/layouts/${id}`);
    }
  });

  for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 800 }]) {
    test(`a Today layout draws the corners on the photo, not a grid, at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await login(page);
      const created = await page.request.post('/api/layouts', { data: { name: `Today e2e ${Date.now()}`, widgets: TODAY_TEMPLATE.widgets, view: 'today' } });
      const layout = await created.json();
      try {
        await page.route('**/api/weather*', (route) => route.fulfill({ json: WEATHER }));
        await page.goto(`/d/${layout.slug}`);
        await page.locator('[data-today-scene]').waitFor({ timeout: 60_000 });
        await page.locator('[data-today-weather]').waitFor();

        await expect(page.locator('.widget-cell'), 'no grid cells').toHaveCount(0);
        const m = await page.evaluate(() => {
          const box = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
          const size = (sel: string) => parseFloat(getComputedStyle(document.querySelector(sel)!).fontSize);
          const probe = document.createElement('div');
          probe.style.fontSize = 'var(--text-floor)';
          document.body.appendChild(probe);
          const floor = parseFloat(getComputedStyle(probe).fontSize);
          probe.remove();
          return {
            scene: box('[data-today-scene]'),
            clock: box('[data-today-clock]'),
            weather: box('[data-today-corner="right"]'),
            sizes: ['[data-today-date]', '[data-today-clock]', '[data-today-temp]', '[data-today-weather]'].map(size),
            floor,
            scroll: document.documentElement.scrollWidth > window.innerWidth,
            clockFont: getComputedStyle(document.querySelector('[data-today-clock]')!).fontFamily,
          };
        });
        expect(m.clock.left - m.scene.left, 'clock near the left edge of the scene').toBeLessThan(70);
        expect(m.scene.right - m.weather.right, 'weather near the right edge').toBeLessThan(70);
        expect(Math.abs(m.clock.top - m.weather.top), 'one top line').toBeLessThan(40);
        for (const s of m.sizes) expect(s).toBeGreaterThanOrEqual(m.floor - 0.01);
        expect(m.scroll, 'no sideways scroll').toBe(false);
        expect(m.clockFont, 'the clock in the display face').toMatch(/Literata/i);
        await expect(page.locator('[data-today-weather]')).toHaveText('Partly Cloudy, high 79°F');
      } finally {
        await page.request.delete(`/api/layouts/${layout.id}`);
      }
    });
  }

  // #909: the day as the sun's path, each timed event a bead on it, in time order.
  test('the sun arc puts each event as a bead on the path, in time order', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await login(page);
    const parentId = getSeededParentId();
    const d = new Date();
    const at = (h: number, m = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).toISOString();
    const made: string[] = [];
    for (const [title, h] of [['Arc check late', 21], ['Arc check early', 19], ['Arc check mid', 20]] as const) {
      const res = await page.request.post('/api/events', { data: { title, startTime: at(h), endTime: at(h, 30), allDay: false, createdBy: parentId } });
      expect(res.status()).toBe(201);
      made.push((await res.json()).id);
    }
    const created = await page.request.post('/api/layouts', { data: { name: `Arc e2e ${Date.now()}`, widgets: TODAY_TEMPLATE.widgets, view: 'today' } });
    const layout = await created.json();
    try {
      await page.route('**/api/weather*', (route) => route.fulfill({ json: { ...WEATHER, sunrise: at(6, 30), sunset: at(17, 30) } }));
      await page.goto(`/d/${layout.slug}`);
      await page.locator('[data-arc-bead]').first().waitFor({ timeout: 60_000 });
      await expect(page.locator('[data-arc-sunset]')).toHaveCount(1);
      const m = await page.evaluate(() => {
        const path = document.querySelector('[data-arc-path]') as SVGPathElement;
        const len = path.getTotalLength();
        const samples: Array<{ x: number; y: number }> = [];
        for (let i = 0; i <= 2000; i++) { const p = path.getPointAtLength((len * i) / 2000); samples.push({ x: p.x, y: p.y }); }
        return [...document.querySelectorAll('[data-arc-bead]')].map((b) => {
          const cx = Number(b.getAttribute('cx')), cy = Number(b.getAttribute('cy'));
          const off = Math.min(...samples.map((p) => Math.hypot(p.x - cx, p.y - cy)));
          return { start: Number(b.getAttribute('data-start')), cx, off };
        });
      });
      expect(m.length).toBeGreaterThanOrEqual(3);
      for (const b of m) expect(b.off, 'bead on the path').toBeLessThanOrEqual(2);
      const byStart = [...m].sort((a, b) => a.start - b.start);
      for (let i = 1; i < byStart.length; i++) {
        if (byStart[i]!.start > byStart[i - 1]!.start) expect(byStart[i]!.cx, 'later is further right').toBeGreaterThan(byStart[i - 1]!.cx);
      }
    } finally {
      await page.request.delete(`/api/layouts/${layout.id}`);
      for (const id of made) await page.request.delete(`/api/events/${id}`);
    }
  });

  // #910: a busy day stays readable: no two labels overlap, none leaves the
  // screen, and what does not fit is "+N", which lists the rest in a sheet.
  test('a 12-event day keeps its labels apart and folds the rest into +N', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const d = new Date();
    const at = (h: number, m = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
    // 9 in the morning, so every event is still ahead whenever the suite runs.
    await page.clock.install({ time: at(9) });
    await login(page);
    const parentId = getSeededParentId();
    const made: string[] = [];
    for (let i = 0; i < 12; i++) {
      const start = at(10 + Math.floor(i / 2), (i % 2) * 30);
      const res = await page.request.post('/api/events', {
        data: { title: `Busy ${i + 1} practice`, startTime: start.toISOString(), endTime: new Date(start.getTime() + 25 * 60_000).toISOString(), allDay: false, createdBy: parentId },
      });
      expect(res.status()).toBe(201);
      made.push((await res.json()).id);
    }
    const created = await page.request.post('/api/layouts', { data: { name: `Busy e2e ${Date.now()}`, widgets: TODAY_TEMPLATE.widgets, view: 'today' } });
    const layout = await created.json();
    try {
      await page.route('**/api/weather*', (route) => route.fulfill({ json: { ...WEATHER, sunrise: at(6, 30).toISOString(), sunset: at(17, 30).toISOString() } }));
      await page.goto(`/d/${layout.slug}`);
      await page.locator('[data-arc-label]').first().waitFor({ timeout: 60_000 });
      const m = await page.evaluate(() => {
        const rects = [...document.querySelectorAll('[data-arc-label], [data-arc-sunset-label], [data-arc-more]')]
          .map((el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, text: el.textContent }; });
        const overlaps: string[] = [];
        for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i]!, b = rects[j]!;
          if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) overlaps.push(`${a.text} / ${b.text}`);
        }
        const outside = rects.filter((r) => r.left < 0 || r.right > innerWidth || r.top < 0 || r.bottom > innerHeight).map((r) => r.text);
        return {
          overlaps, outside,
          labels: document.querySelectorAll('[data-arc-label]').length,
          ahead: document.querySelectorAll('[data-arc-bead]:not([data-past])').length,
          more: document.querySelector('[data-arc-more]')?.textContent ?? '',
        };
      });
      expect(m.overlaps, 'no two labels overlap').toEqual([]);
      expect(m.outside, 'every label on screen').toEqual([]);
      const folded = Number(m.more.replace('+', ''));
      expect(folded, 'some events fold into +N').toBeGreaterThan(0);
      // The 12 here, plus any the seeded family already has today.
      expect(m.ahead).toBeGreaterThanOrEqual(12);
      expect(m.labels + folded, 'every event ahead is labelled or counted').toBe(m.ahead);

      await page.locator('[data-arc-more]').click();
      await expect(page.locator('[data-arc-more-list] li')).toHaveCount(folded);
    } finally {
      await page.request.delete(`/api/layouts/${layout.id}`);
      for (const id of made) await page.request.delete(`/api/events/${id}`);
    }
  });
});
