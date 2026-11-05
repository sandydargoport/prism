import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import { getSeededParentId } from './helpers/auth';

/**
 * The weather widget's sun arc reads over a photo (#672): with a wallpaper
 * showing, the arc has the soft shadow the corner tiles use, and the times
 * keep their backing. Without a wallpaper it is drawn as before.
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const SCENERY = path.join(__dirname, '..', 'public', 'scenery');

async function weatherLayout(page: Page, wallpaper: boolean) {
  await page.setViewportSize({ width: 1920, height: 1080 });
  expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: process.env.E2E_PIN || '1234' } })).ok()).toBe(true);
  await page.addInitScript((on) => {
    localStorage.setItem('prism-wallpaper-enabled', on ? 'true' : 'false');
    localStorage.setItem('prism-wallpaper-interval', '60');
  }, wallpaper);
  const day = new Date();
  const at = (h: number) => { const d = new Date(day); d.setHours(h, 0, 0, 0); return d.toISOString(); };
  await page.route('**/api/weather*', (route) => route.fulfill({ json: {
    location: 'Springfield',
    current: { temperature: 70, feelsLike: 70, condition: 'sunny', humidity: 40, windSpeed: 5, description: 'Sunny' },
    forecast: [{ date: day.toISOString(), dayName: 'Today', high: 75, low: 55, condition: 'sunny' }],
    hourly: [], units: { temperature: 'F', windSpeed: 'mph', precipitation: 'in' },
    lastUpdated: day.toISOString(), sunrise: at(6), sunset: at(18),
  } }));
  await page.route('**/api/photos?*', (route) => route.fulfill({ json: { photos: [{ id: 'arc-photo', filename: 'a.webp', originalFilename: 'a.webp', mimeType: 'image/webp', width: 1920, height: 1080, orientation: 'landscape', usage: 'wallpaper' }], total: 1 } }));
  await page.route('**/api/photos/arc-photo/file', (route) => route.fulfill({ path: path.join(SCENERY, 'valley.webp'), contentType: 'image/webp' }));
  const layout = await (await page.request.post('/api/layouts', { data: { name: `Arc ${Date.now()}`, widgets: [{ i: 'weather', x: 0, y: 0, w: 14, h: 16 }] } })).json();
  await page.goto(`/d/${layout.slug}`);
  return () => page.request.delete(`/api/layouts/${layout.id}`);
}

test.describe('the weather sun arc over a photo', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database');
  test.setTimeout(90_000);

  test('has a soft shadow while a wallpaper shows, and its times keep their backing', async ({ page }) => {
    const cleanup = await weatherLayout(page, true);
    try {
      const arc = page.locator('[data-sun-arc]');
      await expect(arc).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('html')).toHaveAttribute('data-wallpaper', /.+/, { timeout: 30_000 });
      expect(await arc.evaluate((e) => getComputedStyle(e).filter)).toContain('drop-shadow');
      const backing = await page.getByTestId('sun-times').evaluate((e) => getComputedStyle(e).backgroundColor);
      expect(backing).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    } finally { await cleanup(); }
  });

  test('is drawn plain without a wallpaper', async ({ page }) => {
    const cleanup = await weatherLayout(page, false);
    try {
      const arc = page.locator('[data-sun-arc]');
      await expect(arc).toBeVisible({ timeout: 60_000 });
      expect(await arc.evaluate((e) => getComputedStyle(e).filter)).toBe('none');
    } finally { await cleanup(); }
  });
});
