import { test, expect } from '@playwright/test';
import path from 'path';
import { getFirstParent, getSeededParentId, verifySettingsPinViaAPI } from './helpers/auth';
import { TODAY_TEMPLATE } from '../src/lib/constants/layoutTemplates';

/**
 * Today on a phone (#928): a short photo header with the date and the next
 * event, then the coming days as sentences and the chores and shopping lines,
 * at 390x844. The next event opens the shared event sheet.
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const PIN = process.env.E2E_PIN || '1234';

// The iPhone home-screen app reports the status bar's height only with the
// translucent style; without it the top line sat blurred under the status bar
// (#1041). Any page carries it: it is in the root layout.
test('declares the translucent iPhone status bar, so safe-area padding clears it', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute('content', 'black-translucent');
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
});

// With the iPhone's top inset (59px under the Dynamic Island) every subpage's
// first line of text starts below it, not in the band iOS blurs (#1041).
// Chromium emulates the inset; WebKit cannot, so this runs in Chromium only.
test.describe('Subpages clear the iPhone status bar', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database');
  test.setTimeout(120_000);
  test('no text starts under the status bar', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'safe-area emulation is a Chromium DevTools feature');
    const INSET = 59;
    await page.setViewportSize({ width: 390, height: 844 });
    const cdp = await page.context().newCDPSession(page);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await cdp.send('Emulation.setSafeAreaInsetsOverride' as any, { insets: { top: INSET, bottom: 34 } });
    expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
    await verifySettingsPinViaAPI(page, (await getFirstParent(page)).name);
    for (const path of ['/calendar', '/chores', '/shopping', '/tasks', '/meals', '/settings', '/babysitter', '/travel', '/weekend']) {
      await page.goto(path);
      await page.waitForLoadState('load');
      await page.waitForTimeout(2000);
      const top = await page.evaluate(() => {
        let min = Infinity;
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          if (!n.textContent?.trim()) continue;
          const el = n.parentElement!;
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.opacity === '0') continue;
          const r = document.createRange();
          r.selectNodeContents(n);
          for (const b of r.getClientRects()) {
            if (b.width > 0 && b.height > 0 && b.bottom > 0 && b.top < innerHeight) min = Math.min(min, b.top);
          }
        }
        return min;
      });
      expect(top, `${path}: first text top`).toBeGreaterThanOrEqual(INSET);
    }
  });
});

// With a wallpaper photo behind it, the phone Today page paints above the
// photo and its shade: it sat under them, so the time, the temperature and the
// list were hidden by the tint while the date showed (#1063). Hit testing
// follows paint order, so with the photo layers made hit-testable the topmost
// element over the time must be the time itself.
test('the time and the list paint above the wallpaper photo', async ({ page }) => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database');
  test.setTimeout(90_000);
  const SCENERY = path.join(__dirname, '..', 'public', 'scenery');
  const photo = { id: 'phone-bg', filename: 'phone-bg.webp', originalFilename: 'phone-bg.webp', mimeType: 'image/webp', width: 1080, height: 1920, orientation: 'portrait', usage: 'wallpaper' };
  await page.setViewportSize({ width: 390, height: 844 });
  // The iPhone's top inset, for #1098 below.
  const cdp = await page.context().newCDPSession(page);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await cdp.send('Emulation.setSafeAreaInsetsOverride' as any, { insets: { top: 59, bottom: 34 } }).catch(() => {});
  await page.addInitScript(() => localStorage.setItem('prism-wallpaper-enabled', 'true'));
  await page.route('**/api/photos?*', (route) => route.fulfill({ json: { photos: [photo], total: 1 } }));
  await page.route('**/api/photos/phone-bg/file', (route) => route.fulfill({ path: path.join(SCENERY, 'valley.webp'), contentType: 'image/webp' }));
  expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
  const layout = await (await page.request.post('/api/layouts', { data: { name: `Phone photo ${Date.now()}`, widgets: TODAY_TEMPLATE.widgets, view: 'today' } })).json();
  try {
    await page.goto(`/d/${layout.slug}`);
    await expect(page.locator('[data-phone-today-time]')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[data-photo-layer]').first(), 'premise: a photo behind the page').toBeAttached({ timeout: 30_000 });
    const top = await page.evaluate(() => {
      for (const el of document.querySelectorAll<HTMLElement>('[data-photo-layer], [data-wallpaper-shade]')) {
        el.style.pointerEvents = 'auto';
        if (el.parentElement) el.parentElement.style.pointerEvents = 'auto';
      }
      const t = document.querySelector('[data-phone-today-time]')!.getBoundingClientRect();
      const hit = document.elementFromPoint(t.left + t.width / 2, t.top + t.height / 2);
      return !!hit?.closest('[data-phone-today]');
    });
    expect(top, 'the time paints above the photo').toBe(true);
    // #1098: in the iPhone app a fixed layer's box starts below the status
    // bar, so the photo began 59px down with the page colour above it.
    // Chromium starts it at 0, so check the layer reaches the inset's height
    // above its box and still ends at the foot of the screen.
    // The layer that holds the photo and its shade.
    const box = await page.locator('[data-wallpaper-shade]').first().evaluate((e) => { const r = e.parentElement!.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: innerHeight }; });
    expect(box.top, 'the photo reaches up under the status bar').toBeLessThanOrEqual(-58);
    expect(Math.abs(box.bottom - box.h), 'and ends at the foot of the screen').toBeLessThanOrEqual(1);
  } finally {
    await page.request.delete(`/api/layouts/${layout.id}`);
  }
});

// #1076: every phone page, not only Today, refuses a pull past its top; the
// iPhone app dragged subpages and sprang them back.
test.describe('Phone subpages do not drag', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database');
  test.setTimeout(90_000);
  test('a pull down at the top is refused on each subpage', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
    for (const path of ['/calendar', '/chores', '/shopping', '/tasks', '/meals']) {
      await page.goto(path);
      await page.waitForLoadState('load');
      await page.waitForTimeout(1500);
      const refused = await page.evaluate(() => {
        const target = document.elementFromPoint(195, 420) ?? document.body;
        // Every scroller at its top, as when the page opens.
        for (const el of document.querySelectorAll<HTMLElement>('*')) el.scrollTop = 0;
        window.scrollTo(0, 0);
        const at = (y: number) => [new Touch({ identifier: 0, target, clientX: 195, clientY: y })];
        target.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: at(420), targetTouches: at(420), changedTouches: at(420) }));
        const e = new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: at(470), targetTouches: at(470), changedTouches: at(470) });
        target.dispatchEvent(e);
        return e.defaultPrevented;
      });
      expect(refused, `${path}: pull past the top refused`).toBe(true);
      // #1089, #1095: sized from the document's own height. In the iPhone app
      // 100vh and 100dvh are both taller than the area the page lays out in,
      // by about the status bar, so a page that fitted scrolled into empty
      // space. Chromium cannot show that gap, so make the measured height
      // shorter than 100dvh, as the phone reports it, and measure the page.
      const fit = await page.evaluate(async () => {
        const root = document.documentElement;
        const measured = root.style.getPropertyValue('--screen-h');
        const short = innerHeight - 59;
        root.style.setProperty('--screen-h', `${short}px`);
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        const pageEl = document.querySelector('.h-page') as HTMLElement;
        const probe = document.createElement('div');
        probe.style.height = 'var(--nav-bottom, 0px)';
        pageEl.appendChild(probe);
        const navPx = probe.getBoundingClientRect().height;
        probe.remove();
        const out = {
          measured,
          clientHeight: root.clientHeight,
          pageHeight: pageEl.getBoundingClientRect().height,
          expected: short - navPx,
          // Everything in the page's flow, wrappers included.
          shell: document.body.getBoundingClientRect().height,
          short,
        };
        root.style.setProperty('--screen-h', measured);
        return out;
      });
      expect(fit.measured, `${path}: the document's height is measured`).toBe(`${fit.clientHeight}px`);
      expect(Math.abs(fit.pageHeight - fit.expected), `${path}: the page sizes from it`).toBeLessThanOrEqual(1);
      expect(fit.shell, `${path}: and so do the wrappers around it`).toBeLessThanOrEqual(fit.short + 1);
      expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight), `${path}: no page scroll`).toBeLessThanOrEqual(0);
    }
  });
});

// Settings on a phone neither runs past the screen's edge nor drags sideways:
// a button pushed past the edge made the whole page slide left and right in
// the iPhone app. Every section, at an iPhone mini's width.
test.describe('Settings fits a phone', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database');
  test.setTimeout(240_000);
  test('no section is wider than the screen, and the page does not scroll sideways', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
    await verifySettingsPinViaAPI(page, (await getFirstParent(page)).name);
    await page.goto('/settings');
    const pick = page.locator('select').first();
    await expect(pick).toBeVisible({ timeout: 60_000 });
    const sections = await pick.locator('option').allTextContents();
    expect(sections.length, 'premise: the section picker lists them').toBeGreaterThan(5);
    for (const name of sections) {
      await pick.selectOption({ label: name });
      await page.waitForTimeout(800);
      const fit = await page.evaluate(() => {
        // The section's scroller: the largest box that scrolls up and down.
        const scroller = [...document.querySelectorAll<HTMLElement>('main *')]
          .filter((e) => getComputedStyle(e).overflowY === 'auto')
          .sort((x, y) => y.clientWidth * y.clientHeight - x.clientWidth * x.clientHeight)[0]!;
        const past = [...scroller.querySelectorAll<HTMLElement>('*')]
          .filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > innerWidth + 1; })
          .map((e) => `${e.tagName} "${(e.textContent || '').trim().slice(0, 30)}"`);
        scroller.scrollLeft = 50;
        const slid = scroller.scrollLeft;
        scroller.scrollLeft = 0;
        return { past: past.slice(0, 3), slid };
      });
      expect(fit.past, `${name}: nothing past the right edge`).toEqual([]);
      expect(fit.slid, `${name}: no sideways scroll`).toBe(0);
    }
  });
});

test.describe('Today on a phone', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database');
  test.setTimeout(90_000);

  test('header, sentences and lines in order, nothing under the floor, no sideways scroll, the next event opens its sheet', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
    const tag = Date.now();
    // Under way all day from 00:01, so it is the earliest event still going
    // whenever the test runs; and one tomorrow so the sentences have a day.
    const later = new Date(); later.setHours(0, 1, 0, 0);
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(16, 0, 0, 0);
    const made: string[] = [];
    const endOfToday = new Date(); endOfToday.setHours(23, 58, 0, 0);
    for (const [title, start, end] of [[`Phone next ${tag}`, later, endOfToday], [`Phone tomorrow ${tag}`, tomorrow, new Date(tomorrow.getTime() + 30 * 60_000)]] as const) {
      const res = await page.request.post('/api/events', {
        data: { title, startTime: start.toISOString(), endTime: end.toISOString(), allDay: false, createdBy: getSeededParentId() },
      });
      expect(res.status()).toBe(201);
      made.push((await res.json()).id);
    }
    const layout = await (await page.request.post('/api/layouts', { data: { name: `Phone Today ${tag}`, widgets: TODAY_TEMPLATE.widgets, view: 'today' } })).json();
    try {
      await page.goto(`/d/${layout.slug}`);
      const root = page.locator('[data-phone-today]');
      await expect(root).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('[data-mobile-cards]'), 'no widget cards').toHaveCount(0);
      await expect(root.locator('[data-today-next]')).toContainText(`Phone next ${tag}`);
      await expect(root.locator('[data-today-coming]')).toBeVisible();

      // #1034: the top is two aligned rows, the time with the temperature and
      // the date with the condition.
      const head = await page.evaluate(() => {
        const r = (s: string) => document.querySelector(s)?.getBoundingClientRect() ?? null;
        const size = (s: string) => getComputedStyle(document.querySelector(s)!).fontSize;
        return { time: r('[data-phone-today-time]'), temp: r('[data-phone-today-temp]'), date: r('[data-phone-today-date]'), cond: r('[data-phone-today-condition]'),
          dateSize: size('[data-phone-today-date]'), condSize: size('[data-phone-today-condition]') };
      });
      expect(Math.abs(head.time!.bottom - head.temp!.bottom), 'time and temperature on one line').toBeLessThanOrEqual(2);
      expect(Math.abs(head.date!.top - head.cond!.top), 'date and condition on one line').toBeLessThanOrEqual(2);
      expect(head.dateSize).toBe(head.condSize);

      // #1034: it fits one screen, so it neither scrolls nor bounces.
      const fitScreen = await page.evaluate(() => ({ doc: document.documentElement.scrollHeight, inner: innerHeight, bounce: getComputedStyle(document.documentElement).overscrollBehaviorY, bodyBounce: getComputedStyle(document.body).overscrollBehaviorY }));
      expect(fitScreen.doc, 'no scroll on a page that fits').toBeLessThanOrEqual(fitScreen.inner);
      expect(fitScreen.bounce).toBe('none');
      // The body too, which some iOS versions bounce instead.
      expect(fitScreen.bodyBounce).toBe('none');
      // The iPhone app dragged it anyway, so a one-finger drag is refused,
      // except where something can scroll that way; a pinch is left alone.
      const drag = await page.evaluate(() => {
        const root = document.querySelector('[data-phone-today]')!;
        const box = document.createElement('div');
        box.style.cssText = 'height:40px;overflow-y:auto';
        box.innerHTML = '<div style="height:400px"></div>';
        root.appendChild(box);
        // A finger from y=300 to y=300+dy; true when the move was refused.
        const gesture = (target: Element, dy: number, fingers = 1) => {
          const at = (y: number) => Array.from({ length: fingers }, (_, i) => new Touch({ identifier: i, target, clientX: 100 + i * 50, clientY: y }));
          target.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: at(300), targetTouches: at(300), changedTouches: at(300) }));
          const e = new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: at(300 + dy), targetTouches: at(300 + dy), changedTouches: at(300 + dy) });
          target.dispatchEvent(e);
          return e.defaultPrevented;
        };
        const inner = box.firstElementChild!;
        const r = { pageDown: gesture(root, 40), pageUp: gesture(root, -40), boxUp: gesture(inner, -40), boxPastTop: gesture(inner, 40), pinch: gesture(root, 40, 2) };
        box.remove();
        return r;
      });
      expect(drag, 'refused on a page that fits and past a scroller\'s top; allowed to scroll a scroller and to pinch')
        .toEqual({ pageDown: true, pageUp: true, boxUp: false, boxPastTop: true, pinch: false });

      // #1076: Cards and Reorder act on the phone's cards; Today has none.
      await page.locator('[data-mobile-options]').click();
      await expect(page.getByRole('button', { name: 'Settings' }).or(page.getByRole('link', { name: 'Settings' })).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Reorder' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Cards' })).toHaveCount(0);
      await page.locator('[data-mobile-options]').click();

      // In order, top to bottom: header, sentences, lines.
      const tops = await page.evaluate(() => {
        const top = (sel: string) => document.querySelector(sel)?.getBoundingClientRect().top ?? NaN;
        return { header: top('[data-phone-today-header]'), coming: top('[data-today-coming]'), quiet: top('[data-today-quiet]') };
      });
      expect(tops.header).toBeLessThan(tops.coming);
      if (!Number.isNaN(tops.quiet)) expect(tops.coming).toBeLessThan(tops.quiet);

      const fit = await page.evaluate(() => {
        const probe = document.createElement('div');
        probe.style.fontSize = 'var(--text-floor)';
        document.body.appendChild(probe);
        const floor = parseFloat(getComputedStyle(probe).fontSize);
        probe.remove();
        let min = Infinity; let where = '';
        const walker = document.createTreeWalker(document.querySelector('[data-phone-today]')!, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const el = n.parentElement;
          if (!el || !n.textContent?.trim() || el.getBoundingClientRect().width === 0) continue;
          const size = parseFloat(getComputedStyle(el).fontSize);
          if (size < min) { min = size; where = n.textContent.trim().slice(0, 40); }
        }
        return { floor, min, where, scrollW: document.documentElement.scrollWidth, w: window.innerWidth };
      });
      expect(fit.min, `smallest text "${fit.where}"`).toBeGreaterThanOrEqual(fit.floor);
      expect(fit.scrollW, 'no sideways scroll').toBeLessThanOrEqual(fit.w);

      // With no photo behind it, the header is in the page's ink, not white
      // on paper.
      const ink = await page.evaluate(() => ({
        photo: !!document.documentElement.dataset.wallpaper,
        header: getComputedStyle(document.querySelector('[data-today-next]')!).color,
        page: getComputedStyle(document.body).color,
      }));
      if (!ink.photo) expect(ink.header).toBe(ink.page);

      const next = root.locator('[data-today-next]');
      expect((await next.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await next.click();
      await expect(page.locator('[data-event-sheet]').getByRole('heading', { name: `Phone next ${tag}` })).toBeVisible();
    } finally {
      await page.request.delete(`/api/layouts/${layout.id}`);
      for (const id of made) await page.request.delete(`/api/events/${id}`);
    }
  });
});
