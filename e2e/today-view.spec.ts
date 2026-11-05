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
});
