import { test, expect } from '@playwright/test';
import path from 'path';
import { getSeededParentId } from './helpers/auth';
import { TODAY_TEMPLATE } from '../src/lib/constants/layoutTemplates';

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

/**
 * The slow zoom (#955): each photo scales slowly over its time on screen,
 * anchored on its focal point (#956). Off under reduced motion and below the
 * full performance level.
 */
async function zoomPage(page: import('@playwright/test').Page, opts: { mode?: string; reduced?: boolean } = {}) {
  await page.setViewportSize({ width: 1920, height: 1080 });
  if (opts.reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((mode) => {
    localStorage.setItem('prism-wallpaper-enabled', 'true');
    localStorage.setItem('prism-wallpaper-interval', '20');
    localStorage.setItem('prism-perf-mode', mode);
  }, opts.mode ?? 'full');
  await page.route('**/api/photos?*', (route) => route.fulfill({ json: {
    photos: [{ ...photo('zoom-a'), focalX: 0.2, focalY: 0.7 }, { ...photo('zoom-b'), focalX: 0.8, focalY: 0.3 }], total: 2,
  } }));
  await page.route('**/api/photos/zoom-*/file', (route) => route.fulfill({ path: path.join(SCENERY, 'valley.webp'), contentType: 'image/webp' }));
  await page.goto('/');
  const front = page.locator('[data-photo-stage] [data-photo-layer="front"]').first();
  await expect(front).toHaveCount(1, { timeout: 60_000 });
  return front;
}

const scaleOf = (el: import('@playwright/test').Locator) =>
  el.evaluate((e) => ({ scale: new DOMMatrix(getComputedStyle(e).transform).a, origin: getComputedStyle(e).transformOrigin }));

test('each photo zooms slowly, anchored on its subject', async ({ page }) => {
  test.setTimeout(60_000);
  const front = await zoomPage(page);
  await expect(front).toHaveAttribute('data-zoom', 'on');
  const a = await scaleOf(front);
  await page.waitForTimeout(3000);
  const b = await scaleOf(front);
  // In from 1.03 or out from 1.12, a little further along after 3s.
  expect(a.scale).toBeGreaterThanOrEqual(1.03 - 0.001);
  expect(a.scale).toBeLessThanOrEqual(1.12 + 0.001);
  expect(Math.abs(b.scale - a.scale), 'it is moving').toBeGreaterThan(0.002);
  expect(Math.abs(b.scale - a.scale), 'slowly').toBeLessThan(0.03);
  // Anchored on the photo's focal point, whichever of the two is showing.
  const [ox, oy] = b.origin.split(' ').map(parseFloat);
  const at = (fx: number, fy: number) => Math.abs(ox! - fx * 1920) < 2 && Math.abs(oy! - fy * 1080) < 2;
  expect(at(0.2, 0.7) || at(0.8, 0.3), `origin ${b.origin}`).toBe(true);
});

for (const c of [{ name: 'under reduced motion', reduced: true }, { name: 'below the full performance level', mode: 'reduced' }]) {
  test(`no zoom ${c.name}`, async ({ page }) => {
    test.setTimeout(60_000);
    const front = await zoomPage(page, c);
    await expect(front).toHaveAttribute('data-zoom', 'off');
    await page.waitForTimeout(1500);
    expect((await scaleOf(front)).scale).toBe(1);
  });
}

/**
 * The subject where the widgets are not (#957), on a Today layout: a wide
 * photo whose subject would sit under the clock corner in the centred crop is
 * cropped so the subject lands clear of every covered part.
 */
test('a wide photo is cropped so its subject is not under a widget', async ({ page }) => {
  test.skip(process.env.E2E_HAS_TEST_DB !== '1', 'needs the seeded test database');
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: process.env.E2E_PIN || '1234' } })).ok()).toBe(true);
  const layout = await (await page.request.post('/api/layouts', { data: { name: `Subject ${Date.now()}`, widgets: TODAY_TEMPLATE.widgets, view: 'today' } })).json();
  try {
    await page.addInitScript(() => {
      localStorage.setItem('prism-wallpaper-enabled', 'true');
      localStorage.setItem('prism-wallpaper-interval', '60');
    });
    await page.route('**/api/photos?*', (route) => route.fulfill({ json: { photos: [], total: 0 } }));
    await page.goto(`/d/${layout.slug}`);
    const corner = page.locator('[data-today-corner="left"]');
    await expect(corner).toBeVisible({ timeout: 60_000 });
    const covering = () => page.evaluate(() => [...document.querySelectorAll('[data-today-corner], [data-today-quiet], [data-today-coming-wrap], [data-today-arc], [data-dock], .widget-cell')]
      .map((e) => ({ ...(e.getBoundingClientRect().toJSON() as DOMRect), what: `${e.tagName}.${String(e.className).slice(0, 30)}|${e.closest('[data-screensaver-night],[class*="z-9999"]') ? 'in-screensaver' : 'page'}` }))
      .filter((r) => r.width > 0 && r.height > 0));
    const box = (await corner.boundingBox())!;
    const cx = box.x + box.width / 2; const cy = box.y + box.height / 2;

    // A 4:1 photo: centred, its subject would land on the clock corner.
    const W = 4320; const offX = (W - 1920) / 2;
    const focal = { x: (cx + offX) / W, y: cy / 1080 };
    await page.unroute('**/api/photos?*');
    await page.route('**/api/photos?*', (route) => route.fulfill({ json: {
      photos: [{ ...photo('wide'), width: 4320, height: 1080, focalX: focal.x, focalY: focal.y }], total: 1,
    } }));
    await page.route('**/api/photos/wide/file', (route) => route.fulfill({ path: path.join(SCENERY, 'valley.webp'), contentType: 'image/webp' }));
    await page.reload();
    const front = page.locator('[data-photo-stage] [data-photo-layer="front"]').first();
    await expect(front).toHaveCount(1, { timeout: 60_000 });
    await page.waitForTimeout(2500);
    const subject = await front.evaluate((e) => ({ x: Number(e.dataset.subjectX) * 1920, y: Number(e.dataset.subjectY) * 1080 }));
    const under = (await covering()).filter((r) => subject.x >= r.left && subject.x <= r.right && subject.y >= r.top && subject.y <= r.bottom);
    expect(under, `subject at ${Math.round(subject.x)},${Math.round(subject.y)}`).toEqual([]);
    expect(Math.abs(subject.x - cx), 'it moved from the centred crop').toBeGreaterThan(20);
  } finally {
    await page.request.delete(`/api/layouts/${layout.id}`);
  }
});

/**
 * When a photo was taken (#958): a short line in a free corner, at or above
 * the text floor, unless the household turns it off.
 */
async function captionPage(page: import('@playwright/test').Page, dateSetting?: boolean, grid?: Array<{ i: string; x: number; y: number; w: number; h: number }>) {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(() => {
    localStorage.setItem('prism-wallpaper-enabled', 'true');
    localStorage.setItem('prism-wallpaper-interval', '60');
  });
  if (dateSetting !== undefined) {
    await page.route('**/api/settings', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      const res = await route.fetch();
      const body = await res.json();
      await route.fulfill({ response: res, json: { ...body, settings: { ...(body.settings ?? {}), photoCaptionDate: dateSetting } } });
    });
  }
  await page.route('**/api/photos?*', (route) => route.fulfill({ json: { photos: [{ ...photo('dated'), takenAt: '2019-06-02T12:00:00.000Z' }], total: 1 } }));
  await page.route('**/api/photos/dated/file', (route) => route.fulfill({ path: path.join(SCENERY, 'valley.webp'), contentType: 'image/webp' }));
  // A Today layout leaves a corner free; a full grid would hide the line.
  expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: process.env.E2E_PIN || '1234' } })).ok()).toBe(true);
  const layout = await (await page.request.post('/api/layouts', { data: grid
    ? { name: `Caption ${Date.now()}`, widgets: grid.map((w) => ({ ...w, visible: true })) }
    : { name: `Caption ${Date.now()}`, widgets: TODAY_TEMPLATE.widgets, view: 'today' } })).json();
  await page.goto(`/d/${layout.slug}`);
  await expect(page.locator('[data-photo-stage] [data-photo-layer="front"]').first()).toHaveCount(1, { timeout: 60_000 });
  return () => page.request.delete(`/api/layouts/${layout.id}`);
}

test('the photo says when it was taken, in a free corner, at the text floor or above', async ({ page }) => {
  test.skip(process.env.E2E_HAS_TEST_DB !== '1', 'needs the seeded test database');
  test.setTimeout(60_000);
  const cleanup = await captionPage(page);
  try {
  const caption = page.locator('[data-photo-caption]');
  await expect(caption).toHaveText('June 2019', { timeout: 10_000 });
  const m = await caption.evaluate((el) => {
    const probe = document.createElement('div'); probe.style.fontSize = 'var(--text-floor)'; document.body.appendChild(probe);
    const floor = parseFloat(getComputedStyle(probe).fontSize); probe.remove();
    const r = el.getBoundingClientRect();
    const covered = [...document.querySelectorAll('.widget-cell, [data-today-corner], [data-today-quiet], [data-today-coming-wrap], [data-dock]')]
      .map((e) => e.getBoundingClientRect())
      .filter((c) => c.width > 0 && c.width * c.height < 0.6 * innerWidth * innerHeight)
      .filter((c) => r.left < c.right && c.left < r.right && r.top < c.bottom && c.top < r.bottom);
    return { size: parseFloat(getComputedStyle(el).fontSize), floor, overlaps: covered.length, spot: (el as HTMLElement).dataset.photoCaption, low: r.bottom / innerHeight };
  });
  expect(m.size).toBeGreaterThanOrEqual(m.floor);
  expect(m.overlaps, `in ${m.spot}`).toBe(0);
  // In a bottom corner (#992), lifted at most a little, never the top centre.
  expect(m.spot).toMatch(/^bottom-(left|right)$/);
  expect(m.low).toBeGreaterThan(0.75);
  } finally { await cleanup(); }
});

test('no date line when the household turns it off', async ({ page }) => {
  test.skip(process.env.E2E_HAS_TEST_DB !== '1', 'needs the seeded test database');
  test.setTimeout(60_000);
  const cleanup = await captionPage(page, false);
  try {
    await page.waitForTimeout(2500);
    await expect(page.locator('[data-photo-caption]')).toHaveCount(0);
  } finally { await cleanup(); }
});

test('with both bottom corners covered the line hides, never moving to the top centre (#992)', async ({ page }) => {
  test.skip(process.env.E2E_HAS_TEST_DB !== '1', 'needs the seeded test database');
  test.setTimeout(60_000);
  // A grid with widgets across the bottom left and bottom right, the top free.
  const cleanup = await captionPage(page, true, [
    { i: 'clock', x: 0, y: 17, w: 20, h: 10 },
    { i: 'weather', x: 28, y: 17, w: 20, h: 10 },
  ]);
  try {
    await expect(page.locator('.widget-cell').first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(2500);
    await expect(page.locator('[data-photo-caption]')).toHaveCount(0);
  } finally { await cleanup(); }
});

/**
 * "On this day" (#959): with the setting on, a photo from this date in an
 * earlier year joins the rotation first, and its line says so.
 */
test('On this day: a photo from this date in an earlier year comes first, and says so', async ({ page }) => {
  test.skip(process.env.E2E_HAS_TEST_DB !== '1', 'needs the seeded test database');
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(() => {
    localStorage.setItem('prism-wallpaper-enabled', 'true');
    localStorage.setItem('prism-wallpaper-interval', '60');
  });
  await page.route('**/api/settings', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const res = await route.fetch();
    const body = await res.json();
    await route.fulfill({ response: res, json: { ...body, settings: { ...(body.settings ?? {}), photoOnThisDay: true } } });
  });
  const now = new Date();
  const then = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate(), 12);
  let askedForThisDay = '';
  await page.route('**/api/photos?*', (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('onThisDayMonth')) {
      askedForThisDay = `${url.searchParams.get('onThisDayMonth')}-${url.searchParams.get('onThisDayDay')}`;
      return route.fulfill({ json: { photos: [{ ...photo('otd'), takenAt: then.toISOString() }], total: 1 } });
    }
    return route.fulfill({ json: { photos: [photo('everyday-a'), photo('everyday-b')], total: 2 } });
  });
  await page.route('**/api/photos/*/file', (route) => route.fulfill({ path: path.join(SCENERY, 'valley.webp'), contentType: 'image/webp' }));
  expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: process.env.E2E_PIN || '1234' } })).ok()).toBe(true);
  const layout = await (await page.request.post('/api/layouts', { data: { name: `OTD ${Date.now()}`, widgets: TODAY_TEMPLATE.widgets, view: 'today' } })).json();
  try {
    await page.goto(`/d/${layout.slug}`);
    await expect(page.locator('[data-photo-stage] [data-photo-layer]').first()).toHaveAttribute('style', /otd/, { timeout: 60_000 });
    expect(askedForThisDay, "asked for the screen's own date").toBe(`${now.getMonth() + 1}-${now.getDate()}`);
    await expect(page.locator('[data-photo-caption]')).toHaveText(`On this day, ${then.getFullYear()}`, { timeout: 10_000 });
  } finally {
    await page.request.delete(`/api/layouts/${layout.id}`);
  }
});
