import { test, expect, type Page } from '@playwright/test';
import { getSeededParentId } from './helpers/auth';
import { TODAY_TEMPLATE } from '../src/lib/constants/layoutTemplates';

/**
 * The dock on the wall (#922): a Menu word at rest, a labelled one-row dock on
 * a touch, gone after ten quiet seconds, and More with every other page and
 * this screen's jobs. Measured, at the wall's size and the small tablet's.
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const PIN = process.env.E2E_PIN || '1234';

test.describe('the dock on the wall', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database to log in and create a dashboard');
  test.setTimeout(90_000);

  async function openToday(page: Page) {
    const login = await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } });
    expect(login.ok(), 'precondition: login must succeed').toBe(true);
    const layout = await (await page.request.post('/api/layouts', { data: { name: `Dock e2e ${Date.now()}`, widgets: TODAY_TEMPLATE.widgets, view: 'today' } })).json();
    await page.goto(`/d/${layout.slug}`);
    await page.locator('[data-today-clock]').waitFor({ timeout: 60_000 });
    return layout as { id: string };
  }

  for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 800 }]) {
    test(`Menu at rest, a labelled one-row dock on a touch, gone after ten seconds, at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      // The clock is installed so the ten seconds can pass at once; taps are
      // raw mouse events, which need no animation frames.
      await page.clock.install();
      const layout = await openToday(page);
      try {
        await expect(page.locator('[data-dock-menu]')).toBeVisible();
        await expect(page.locator('[data-dock]')).toHaveAttribute('aria-hidden', 'true');
        await expect(page.locator('aside')).toHaveCount(0); // no rail on the wall
        const clockBefore = await page.locator('[data-today-clock]').boundingBox();

        await page.mouse.click(viewport.width / 2, viewport.height / 2);
        await expect(page.locator('[data-dock]')).not.toHaveAttribute('aria-hidden', 'true');
        const m = await page.evaluate(() => {
          const items = [...document.querySelectorAll('[data-dock] > a, [data-dock] > button')];
          return items.map((el) => {
            const r = el.getBoundingClientRect();
            return { text: (el.textContent ?? '').trim(), top: r.top, w: r.width, h: r.height, left: r.left, right: r.right };
          });
        });
        expect(m.length).toBe(8); // six pages, More, Sign in
        for (const item of m) {
          expect(item.text.length, 'every item is labelled').toBeGreaterThan(0);
          expect(item.w).toBeGreaterThanOrEqual(44);
          expect(item.h).toBeGreaterThanOrEqual(44);
          expect(item.left).toBeGreaterThanOrEqual(0);
          expect(item.right).toBeLessThanOrEqual(viewport.width);
        }
        const tops = m.map((i) => i.top);
        expect(Math.max(...tops) - Math.min(...tops), 'one row').toBeLessThanOrEqual(2);
        expect(await page.locator('[data-today-clock]').boundingBox(), 'nothing on the page moves').toEqual(clockBefore);

        await page.clock.runFor(11_000);
        await expect(page.locator('[data-dock]')).toHaveAttribute('aria-hidden', 'true');
        await expect(page.locator('[data-dock-menu]')).toBeVisible();

        // #989: a tab on the bottom edge, holding Menu...
        const tab = page.locator('[data-dock-menu-tab]');
        await expect(tab).toContainText('Menu');
        const rest = (await tab.boundingBox())!;
        // ...that can be read with no photo behind it, in either theme.
        const contrast = await tab.evaluate((el) => {
          if (document.documentElement.hasAttribute('data-wallpaper')) return 99;
          const rgba = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
          const rgb = (c: string): [number, number, number] => { const [r = 0, g = 0, b = 0] = rgba(c); return [r, g, b]; };
          const lum = ([r, g, b]: [number, number, number]) => {
            const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
            return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
          };
          const text = lum(rgb(getComputedStyle(el).color));
          // The page's own ground: the first painted background under the tab.
          let bg = 'rgb(255, 255, 255)';
          for (const e of document.elementsFromPoint(innerWidth / 2, innerHeight - 60)) {
            const c = getComputedStyle(e).backgroundColor;
            const a = rgba(c)[3];
            if (c !== 'transparent' && (a === undefined || a > 0.5)) { bg = c; break; }
          }
          const page = lum(rgb(bg));
          return (Math.max(text, page) + 0.05) / (Math.min(text, page) + 0.05);
        });
        expect(contrast, 'Menu readable on the page').toBeGreaterThanOrEqual(3);
        expect(Math.abs(rest.y + rest.height - viewport.height), 'on the bottom edge').toBeLessThanOrEqual(1);
        // ...that shrinks to a nub after a few quiet seconds...
        await page.clock.runFor(9_000);
        await expect(page.locator('[data-dock-menu]')).toHaveAttribute('data-nub', 'true');
        await page.waitForTimeout(700);
        const nub = (await tab.boundingBox())!;
        expect(nub.width).toBeLessThanOrEqual(44);
        expect(nub.height).toBeLessThanOrEqual(8);
        expect(Math.abs(nub.y + nub.height - viewport.height)).toBeLessThanOrEqual(1);
        // ...and a tap anywhere brings the dock back.
        await page.mouse.click(viewport.width / 2, viewport.height / 2);
        await expect(page.locator('[data-dock]')).not.toHaveAttribute('aria-hidden', 'true');
      } finally {
        await page.request.delete(`/api/layouts/${layout.id}`);
      }
    });
  }

  test('More has every other page, Settings, Help and this screen\'s jobs', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const layout = await openToday(page);
    try {
      await page.locator('[data-dock-menu]').click();
      const onDock = await page.locator('[data-dock] [data-dock-item]').evaluateAll((els) => els.map((e) => e.getAttribute('data-dock-item')));
      await page.locator('[data-dock-more]').click();
      const panel = page.locator('[data-dock-more-panel]');
      await expect(panel).toBeVisible();
      const inMore = await panel.locator('[data-dock-item]').evaluateAll((els) => els.map((e) => e.getAttribute('data-dock-item')));
      expect(inMore).toContain('/settings');
      expect(inMore).toContain('/help');
      expect(onDock.filter((h) => inMore.includes(h)), 'no page in both').toEqual([]);
      await expect(panel.locator('[data-screen-job="reload"]')).toBeVisible();
      await expect(panel.locator('[data-screen-job="screensaver"]')).toBeVisible();
      await expect(panel.locator('[data-screen-job="edit"]')).toBeVisible();
      // #1006: every job is named, the same way, in the same pill.
      await expect(panel.locator('[data-screen-job="away"]')).toBeVisible();
      await expect(panel.locator('[data-screen-job="babysitter"]')).toBeVisible();
      // #1014: Settings and Help first, set apart; one Babysitter, the page.
      await expect(panel.locator('[data-dock-more-top] [data-dock-item="/settings"]')).toBeVisible();
      await expect(panel.locator('[data-dock-more-top] [data-dock-item="/help"]')).toBeVisible();
      await expect(panel.locator('[data-dock-more-grid] [data-dock-item="/settings"]'), 'Settings is not a page tile').toHaveCount(0);
      const top = await panel.locator('[data-dock-more-top]').evaluate((e) => e.getBoundingClientRect().bottom);
      const firstPage = await panel.locator('[data-dock-more-grid]').evaluate((e) => e.getBoundingClientRect().top);
      expect(top, 'Settings and Help above the pages').toBeLessThanOrEqual(firstPage);
      await expect(panel.getByText('Pages', { exact: true })).toBeVisible();
      // The modes stay one tap away, under This screen, apart from the pages.
      await expect(panel.locator('[data-dock-screen-jobs] [data-screen-job="babysitter"]')).toHaveText('Babysitter mode');
      await expect(panel.locator('[data-dock-pages] [data-screen-job]'), 'no mode among the pages').toHaveCount(0);
      const jobs = await panel.locator('[data-screen-job]').evaluateAll((els) => els.map((e) => ({
        job: e.getAttribute('data-screen-job'), text: (e.textContent ?? '').trim(), h: Math.round(e.getBoundingClientRect().height),
      })));
      for (const j of jobs) expect(j.text, `${j.job} has a name`).not.toBe('');
      // A mode is not confused with the page of the same name.
      expect(jobs.find((j) => j.job === 'babysitter')!.text).toBe('Babysitter mode');
      expect(jobs.find((j) => j.job === 'away')!.text).toBe('Away mode');
      expect(new Set(jobs.map((j) => j.h)).size, `one height for every job: ${JSON.stringify(jobs)}`).toBe(1);
      // Tiles like the pages (#1006): five a row, each job's icon above its name.
      for (const grid of ['[data-dock-more-grid]', '[data-dock-jobs-grid]']) {
        const cols = await panel.locator(grid).evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(' ').length);
        expect(cols, `${grid}: five a row`).toBe(5);
      }
      const stacked = await panel.locator('[data-screen-job]').evaluateAll((els) => els.map((e) => {
        const icon = e.querySelector('svg')!.getBoundingClientRect();
        const name = [...e.querySelectorAll('span')].find((x) => (x.textContent ?? '').trim())!.getBoundingClientRect();
        return { job: e.getAttribute('data-screen-job'), above: icon.bottom <= name.top + 1, size: Math.round(icon.width), top: Math.round(icon.top) };
      }));
      for (const j of stacked) expect(j.above, `${j.job}: icon above its name`).toBe(true);
      expect(new Set(stacked.map((j) => j.size)).size, `one icon size: ${JSON.stringify(stacked)}`).toBe(1);
      expect(new Set(stacked.map((j) => j.top)).size, `icons on one line: ${JSON.stringify(stacked)}`).toBe(1);
    } finally {
      await page.request.delete(`/api/layouts/${layout.id}`);
    }
  });

  // #923: the dock stays on every other page, marks where you are, never
  // covers the page's last row, and Home goes back to the screen's dashboard.
  for (const path of ['/chores', '/shopping', '/calendar']) {
    test(`the dock stays on ${path}, marks it, and keeps the page clear of it`, async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      const login = await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } });
      expect(login.ok()).toBe(true);
      await page.goto(`${path}?from=kitchen`);
      const dock = page.locator('[data-dock]');
      await expect(dock).toBeVisible({ timeout: 60_000 });
      await expect(dock).not.toHaveAttribute('aria-hidden', 'true');
      await expect(page.locator(`[data-dock-item="${path}"]`)).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('[data-dock-item="/"]'), 'Home goes back to the screen\'s dashboard').toHaveAttribute('href', '/d/kitchen');
      // Scroll everything to the end: the last thing on the page ends above
      // the dock. Measured again until it holds, since a list that loads
      // after the first scroll lands unscrolled.
      const measure = () => page.evaluate(async () => {
        for (const el of [document.scrollingElement, ...document.querySelectorAll('main *')]) {
          if (el && el.scrollHeight > el.clientHeight + 4) el.scrollTop = el.scrollHeight;
        }
        await new Promise((r) => setTimeout(r, 300));
        const dockTop = document.querySelector('[data-dock]')!.getBoundingClientRect().top;
        const main = document.querySelector('main')!;
        let lowest = 0;
        for (const el of main.querySelectorAll('*')) {
          const r = el.getBoundingClientRect();
          if (el.closest('[data-dock]')) continue;
          if (r.width > 0 && r.height > 0 && r.bottom <= innerHeight + 1 && getComputedStyle(el).visibility !== 'hidden') {
            const text = (el as HTMLElement).innerText?.trim();
            if (text && el.children.length === 0) lowest = Math.max(lowest, r.bottom);
          }
        }
        // The page beside the dock reserves the dock's height at its foot,
        // which is what lets a list's last row scroll clear of it.
        const shell = document.querySelector('[data-dock]')!.parentElement!;
        const pageMain = shell.querySelector(':scope > main') as HTMLElement;
        const reserved = parseFloat(getComputedStyle(pageMain).paddingBottom);
        return { dockTop, lowest, reserved, under: innerHeight - dockTop };
      });
      let m = await measure();
      await expect.poll(async () => { m = await measure(); return m.lowest - m.dockTop; },
        { message: 'the last visible text ends above the dock', timeout: 15_000 }).toBeLessThanOrEqual(0);
      expect(m.reserved, 'room for the dock at the foot of the page').toBeGreaterThanOrEqual(m.under);
    });
  }

  // #924: one navigation everywhere. Portrait and phones use the same dock;
  // the rail and the portrait bar are gone.
  for (const screen of [
    { name: 'portrait tablet', width: 1080, height: 1920, pages: 6 },
    { name: 'phone', width: 390, height: 844, pages: 5 },
  ]) {
    test(`the ${screen.name} uses the dock and nothing else`, async ({ page }) => {
      await page.setViewportSize({ width: screen.width, height: screen.height });
      const login = await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } });
      expect(login.ok()).toBe(true);
      await page.goto('/chores');
      const dock = page.locator('[data-dock]');
      await expect(dock).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('aside'), 'no rail').toHaveCount(0);
      await expect(page.locator('[data-portrait-nav]'), 'no portrait bar').toHaveCount(0);
      const m = await dock.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const items = [...el.querySelectorAll(':scope > a, :scope > button')].map((i) => i.getBoundingClientRect());
        return { left: r.left, right: r.right, bottom: r.bottom, items: items.map((i) => ({ w: i.width, h: i.height })), pages: el.querySelectorAll(':scope > a').length };
      });
      expect(m.pages).toBe(screen.pages);
      expect(m.left).toBeGreaterThanOrEqual(0);
      expect(m.right).toBeLessThanOrEqual(screen.width);
      expect(m.bottom).toBeLessThanOrEqual(screen.height);
      for (const i of m.items) {
        expect(i.w).toBeGreaterThanOrEqual(44);
        expect(i.h).toBeGreaterThanOrEqual(44);
      }
      // The phone's own tools button sits above the dock, never on it.
      const fab = page.getByRole('button', { name: 'Dashboard options' });
      if (await fab.count()) {
        const f = await fab.boundingBox();
        const d = await dock.boundingBox();
        expect(f!.y + f!.height, 'tools button above the dock').toBeLessThanOrEqual(d!.y);
      }
    });
  }

  // #1020: on a phone, one clear Add per page and nothing floating over a page's
  // content. The options button is the dashboard's own, and it adds nothing.
  test('on a phone: options only on the dashboard, no "+" on it, and Shopping\'s header keeps one add', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const login = await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } });
    expect(login.ok()).toBe(true);
    await page.goto('/');
    const options = page.locator('[data-mobile-options]');
    await expect(options).toBeVisible({ timeout: 60_000 });
    await expect(options).toHaveAttribute('aria-label', 'Dashboard options');
    await expect(options.locator('svg.lucide-plus'), 'not a "+"').toHaveCount(0);

    await page.goto('/shopping');
    await expect(page.locator('[data-shopping-manage]')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[data-mobile-options]'), 'no options button off the dashboard').toHaveCount(0);
    // #1028: on a subpage the round button is the page's Add; here it brings up the add field.
    const add = page.locator('[data-page-add]');
    await expect(add).toHaveAttribute('aria-label', 'Add item');
    await add.click();
    await expect(page.locator('[data-shopping-add]')).toBeFocused();
    await expect(page.getByRole('button', { name: 'Add List' }), 'New list is in the menu, not a second "+"').toHaveCount(0);
    await page.getByRole('button', { name: 'More options', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: 'New list' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Scan Barcode' })).toBeVisible();
    await page.keyboard.press('Escape');

    // Chores: the header's title, badge and buttons do not overlap.
    await page.goto('/chores');
    await expect(page.locator('[data-chores-manage]')).toBeVisible({ timeout: 60_000 });
    const hdr = await page.evaluate(() => {
      const box = (e: Element | null) => e?.getBoundingClientRect() ?? null;
      const title = box(document.querySelector('h1'));
      const parts = [document.querySelector('h1'), document.querySelector('[data-chores-due-badge]'), document.querySelector('[data-chores-manage]')]
        .filter(Boolean).map((e) => e!.getBoundingClientRect());
      let overlaps = 0;
      for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
        const a = parts[i]!, b = parts[j]!;
        if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) overlaps++;
      }
      return { titleWidth: title?.width ?? 0, overlaps };
    });
    await expect.poll(() => page.locator('h1').first().evaluate((e) => e.getBoundingClientRect().width), { message: 'the title has room' }).toBeGreaterThan(30);
    expect(hdr.overlaps, 'nothing in the header overlaps').toBe(0);
    // #1034: the header's buttons sit inside it, with room above and below.
    const inside = await page.locator('[data-subpage-header]').evaluate((h) => {
      const r = h.getBoundingClientRect();
      return [...h.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().height > 0).map((b) => {
        const x = b.getBoundingClientRect(); return { top: x.top - r.top, bottom: r.bottom - x.bottom };
      });
    });
    for (const b of inside) { expect(b.top, 'room above').toBeGreaterThanOrEqual(4); expect(b.bottom, 'room below').toBeGreaterThanOrEqual(4); }

    // #1036: no screensaver on a phone.
    await page.goto('/');
    await expect(page.locator('[data-mobile-options]')).toBeVisible({ timeout: 60_000 });
    await page.evaluate(() => window.dispatchEvent(new Event('prism:screensaver')));
    await page.waitForTimeout(1500);
    await expect(page.locator('[data-screensaver]'), 'no screensaver on a phone').toHaveCount(0);

    // #1068: the current page's highlight is a rounded rectangle inside a
    // rounded bar, not a pill that squashes into an oval round "Shopping".
    await page.goto('/shopping');
    const current = page.locator('[data-dock] [aria-current="page"]');
    await expect(current).toBeVisible({ timeout: 60_000 });
    const corners = await page.evaluate(() => ({
      item: parseFloat(getComputedStyle(document.querySelector('[data-dock] [aria-current="page"]')!).borderTopLeftRadius),
      bar: parseFloat(getComputedStyle(document.querySelector('[data-dock]')!).borderTopLeftRadius),
    }));
    expect(corners.item, 'highlight corner').toBeLessThanOrEqual(16);
    expect(corners.bar, 'bar corner').toBeLessThanOrEqual(24);

    // #1036: menus have small corners, so their first and last items are not cut by the curve.
    await page.goto('/shopping');
    await page.getByRole('button', { name: 'More options', exact: true }).click();
    const radius = await page.getByRole('menu').evaluate((m) => parseFloat(getComputedStyle(m).borderTopLeftRadius));
    expect(radius, 'menu corner radius').toBeLessThanOrEqual(12);
    await page.keyboard.press('Escape');

    // Never over an open window: on the dashboard, open one and the button goes.
    await page.goto('/');
    await expect(options).toBeVisible({ timeout: 60_000 });
    await page.evaluate(() => { const d = document.createElement('div'); d.setAttribute('role', 'dialog'); d.id = 'probe-dialog'; document.body.appendChild(d); });
    await expect(options).toBeHidden();
    await page.evaluate(() => document.getElementById('probe-dialog')?.remove());
    await expect(options).toBeVisible();
  });

  // #1028: on every subpage the round button is that page's Add, the header has
  // no "+" of its own, and the header is solid (it looked fuzzy over a photo).
  for (const [path, label] of [
    ['/calendar', 'Add Event'], ['/chores', 'Add chore'], ['/tasks', 'Add task'], ['/meals', 'Add meal'],
    ['/messages', 'Add message'], ['/recipes', 'Add recipe'], ['/wishes', 'Add wish'], ['/goals', 'Add goal'],
  ] as const) {
    test(`on a phone, ${path}: the round button is "${label}" and the header has no "+"`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const login = await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } });
      expect(login.ok()).toBe(true);
      await page.goto(path);
      const add = page.locator('[data-page-add]');
      await expect(add).toBeVisible({ timeout: 60_000 });
      await expect(add).toHaveAttribute('aria-label', label);
      await expect(page.locator('header svg.lucide-plus'), 'no "+" in the header').toHaveCount(0);
      const header = page.locator('[data-subpage-header]');
      if (await header.count()) {
        const alpha = await header.evaluate((e) => { const m = getComputedStyle(e).backgroundColor.match(/[\d.]+/g)!.map(Number); return m.length > 3 ? m[3] : 1; });
        expect(alpha, 'a solid header').toBe(1);
      }
      await add.click();
      await expect(page.getByRole('dialog').first(), 'it opens the add form').toBeVisible({ timeout: 15_000 });
    });
  }

  // #925: the household chooses the dock's pages; the rest stay in More.
  test('a page put on the dock takes a place there and the sixth moves into More', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const login = await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } });
    expect(login.ok()).toBe(true);
    const before = (await (await page.request.get('/api/settings')).json()).settings?.dockPages ?? null;
    try {
      const chosen = ['/', '/calendar', '/chores', '/shopping', '/meals', '/recipes'];
      expect((await page.request.patch('/api/settings', { data: { key: 'dockPages', value: chosen } })).ok()).toBe(true);
      await page.addInitScript(() => localStorage.removeItem('prism-dock-pages'));
      await page.goto('/chores');
      const onDock = page.locator('[data-dock] [data-dock-item]');
      await expect(onDock).toHaveCount(6, { timeout: 60_000 });
      await expect(page.locator('[data-dock] [data-dock-item="/recipes"]')).toBeVisible();
      await expect(page.locator('[data-dock] [data-dock-item="/photos"]')).toHaveCount(0);
      await page.locator('[data-dock-more]').click();
      await expect(page.locator('[data-dock-more-panel] [data-dock-item="/photos"]')).toBeVisible();
    } finally {
      await page.request.patch('/api/settings', { data: { key: 'dockPages', value: before ?? ['/', '/calendar', '/chores', '/shopping', '/meals', '/photos'] } });
    }
  });
});
