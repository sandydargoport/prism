import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * One photo stage with a true crossfade (#954). Two stand-in photos (the
 * bundled scenery files, served through route interception) rotate every 8s (longer than the slow file plus the fade).
 * During a swap the photo underneath stays fully opaque while the next fades
 * in over it, so the picture never dips; the next photo is not shown before
 * its file has arrived; and the widgets do not move.
 */
const SCENERY = path.join(__dirname, '..', 'public', 'scenery');
const photo = (id: string) => ({ id, filename: `${id}.webp`, originalFilename: `${id}.webp`, mimeType: 'image/webp', width: 1920, height: 1080, orientation: 'landscape', usage: 'wallpaper' });

test('the wallpaper crossfades: the old photo stays opaque under the new one, which waits for its file', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(() => {
    localStorage.setItem('prism-wallpaper-enabled', 'true');
    localStorage.setItem('prism-wallpaper-interval', '8');
  });
  let secondArrivedAt = 0;
  await page.route('**/api/photos?*', (route) => route.fulfill({ json: { photos: [photo('stage-a'), photo('stage-b')], total: 2 } }));
  await page.route('**/api/photos/stage-a/file', (route) => route.fulfill({ path: path.join(SCENERY, 'valley.webp'), contentType: 'image/webp' }));
  await page.route('**/api/photos/stage-b/file', async (route) => {
    // A slow file: the swap must wait for it.
    await new Promise((r) => setTimeout(r, 2500));
    secondArrivedAt = Date.now();
    await route.fulfill({ path: path.join(SCENERY, 'river-sunset.webp'), contentType: 'image/webp' });
  });

  await page.goto('/');
  const stage = page.locator('[data-photo-stage]').first();
  await expect(stage.locator('[data-photo-layer="front"]')).toHaveCount(1, { timeout: 60_000 });
  // The widgets draw after the photo; measure them once they are all there.
  await expect(page.locator('.widget-cell').first()).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  const widgetsBefore = await page.locator('.widget-cell').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));

  // Wait for the next photo to start fading in.
  const incoming = stage.locator('[data-photo-layer="incoming"]');
  await expect(incoming).toHaveCount(1, { timeout: 20_000 });
  const firstSeenAt = Date.now();
  expect(secondArrivedAt, 'the next photo had arrived before it showed').toBeGreaterThan(0);
  expect(firstSeenAt).toBeGreaterThanOrEqual(secondArrivedAt);

  // Sample the swap: underneath stays 1, on top rises from 0 to 1.
  const samples: Array<{ front: number; incoming: number }> = [];
  for (let i = 0; i < 30; i++) {
    const s = await stage.evaluate((el) => {
      const op = (sel: string) => {
        const l = el.querySelector(sel);
        return l ? parseFloat(getComputedStyle(l).opacity) : NaN;
      };
      return { front: op('[data-photo-layer="front"]'), incoming: op('[data-photo-layer="incoming"]') };
    });
    if (Number.isNaN(s.incoming)) break;
    samples.push(s);
    await page.waitForTimeout(80);
  }
  expect(samples.length, 'caught the swap in progress').toBeGreaterThan(5);
  for (const s of samples) expect(s.front, 'the photo underneath never fades').toBe(1);
  expect(samples.some((s) => s.incoming > 0.05 && s.incoming < 0.95), 'the new photo passes through partly shown').toBe(true);
  for (let i = 1; i < samples.length; i++) expect(samples[i]!.incoming).toBeGreaterThanOrEqual(samples[i - 1]!.incoming - 0.001);

  // The swap ends with one layer, the new photo, fully shown.
  await expect(incoming).toHaveCount(0, { timeout: 5_000 });
  await expect(stage.locator('[data-photo-layer="front"]')).toHaveAttribute('style', /stage-b/);
  const widgetsAfter = await page.locator('.widget-cell').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
  expect(widgetsAfter, 'no widget moved during the crossfade').toEqual(widgetsBefore);
});
