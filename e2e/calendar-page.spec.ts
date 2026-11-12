import { test, expect, type Page } from '@playwright/test';
import { getSeededParentId } from './helpers/auth';

/**
 * The Calendar page in the new look (#879): one Add pill, the calendar
 * filters as a quiet row of person dots, day numbers in the display face with
 * today on a disc, and agenda days headed by a word.
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const PIN = process.env.E2E_PIN || '1234';

async function login(page: Page) {
  expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
}

/** Every visible text node's computed size, against the page's own floor. */
async function smallestText(page: Page) {
  return page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.fontSize = 'var(--text-floor)';
    document.body.appendChild(probe);
    const floor = parseFloat(getComputedStyle(probe).fontSize);
    probe.remove();
    let min = Infinity; let where = '';
    const walker = document.createTreeWalker(document.querySelector('main') ?? document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || !n.textContent?.trim()) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < min) { min = size; where = n.textContent.trim().slice(0, 40); }
    }
    return { floor, min, where };
  });
}

test.describe('the Calendar page', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database');
  test.setTimeout(90_000);

  test('month: one Add pill, dot filters, the day numbers in the display face and today on a disc', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await login(page);
    await page.addInitScript(() => localStorage.setItem('prism-calendar-view-type', 'month'));
    await page.goto('/calendar');
    const add = page.locator('[data-calendar-add-pill]');
    await expect(add).toBeVisible({ timeout: 60_000 });
    // The Add pill is the height of Today beside it, not a size above the
    // rest of the header.
    const box = (await add.boundingBox())!;
    const today = (await page.getByRole('button', { name: /^Today$/ }).boundingBox())!;
    expect(Math.abs(box.height - today.height)).toBeLessThanOrEqual(1);
    await expect(page.locator('[data-calendar-add-pill]'), 'one Add').toHaveCount(1);
    await expect(page.getByRole('button', { name: /^Manage$/ }), 'Manage is in the menu').toHaveCount(0);

    // Filters: no filled chip, each at least 44px.
    const filters = page.locator('[data-calendar-filter]');
    // The calendars load after the page; wait for more than "All".
    await expect(filters.nth(1)).toBeVisible();
    const looks = await filters.evaluateAll((els) => els.map((e) => ({
      bg: getComputedStyle(e).backgroundColor,
      h: e.getBoundingClientRect().height,
    })));
    for (const l of looks) {
      expect(l.bg, 'a filter is a dot and a name, not a filled chip').toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
      expect(l.h).toBeGreaterThanOrEqual(44);
    }

    const todayNum = page.locator('[data-month-daynum][data-today]');
    await expect(todayNum).toHaveCount(1);
    const style = await todayNum.evaluate((e) => {
      const cs = getComputedStyle(e);
      const probe = document.createElement('span');
      probe.style.fontFamily = 'var(--font-display)';
      document.body.appendChild(probe);
      const face = getComputedStyle(probe).fontFamily;
      probe.remove();
      return { font: cs.fontFamily, face, body: getComputedStyle(document.body).fontFamily, bg: cs.backgroundColor, ink: cs.color };
    });
    expect(style.font, 'the day number is in the display face').toBe(style.face);
    expect(style.face).not.toBe(style.body);
    expect(style.bg, 'today is on a disc').not.toMatch(/rgba\(0, 0, 0, 0\)/);
    expect(style.bg, 'the disc is not a second accent colour').not.toBe(style.ink);

    const text = await smallestText(page);
    expect(text.min, `smallest text "${text.where}"`).toBeGreaterThanOrEqual(text.floor);
  });

  // #1082 (part of #1043): the page asks for the months around the date it
  // shows, not four years, and paging into a later quarter still finds a
  // later event.
  test('fetches the months around the shown date, and paging finds later events', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await login(page);
    const title = `Five months on ${Date.now()}`;
    const start = new Date(); start.setDate(15); start.setMonth(start.getMonth() + 5); start.setHours(10, 0, 0, 0);
    const res = await page.request.post('/api/events', {
      data: { title, startTime: start.toISOString(), endTime: new Date(start.getTime() + 3_600_000).toISOString(), allDay: false, createdBy: getSeededParentId() },
    });
    expect(res.status()).toBe(201);
    const id = (await res.json()).id;
    const spans: number[] = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (u.pathname !== '/api/events') return;
      const from = Date.parse(u.searchParams.get('startDate') ?? '');
      const to = Date.parse(u.searchParams.get('endDate') ?? '');
      if (from && to) spans.push((to - from) / 86_400_000);
    });
    try {
      await page.addInitScript(() => localStorage.setItem('prism-calendar-view-type', 'month'));
      await page.goto('/calendar');
      await expect(page.locator('[data-calendar-add-pill]')).toBeVisible({ timeout: 60_000 });
      await expect.poll(() => spans.length, { timeout: 15_000 }).toBeGreaterThan(0);
      expect(Math.max(...spans), 'days asked for at once').toBeLessThan(300);
      // Paging into the next quarter loads its window behind the events on
      // screen: no spinner replaces the calendar.
      await page.evaluate(() => {
        const w = window as unknown as { __spun: boolean };
        w.__spun = false;
        new MutationObserver(() => { if (document.querySelector('main .animate-spin')) w.__spun = true; })
          .observe(document.body, { childList: true, subtree: true });
      });
      const next = page.getByRole('button', { name: 'Next', exact: true });
      for (let i = 0; i < 5; i++) await next.click();
      await expect(page.getByText(title).first(), 'the later event, from the next window').toBeVisible({ timeout: 15_000 });
      expect(await page.evaluate(() => (window as unknown as { __spun: boolean }).__spun), 'no spinner while paging').toBe(false);
    } finally {
      await page.request.delete(`/api/events/${id}`);
    }
  });

  test('agenda: days are headed by a word, the date beside it as meta', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await login(page);
    const start = new Date(); start.setDate(start.getDate() + 1); start.setHours(15, 0, 0, 0);
    const ev = await page.request.post('/api/events', {
      data: { title: `Agenda word ${Date.now()}`, startTime: start.toISOString(), endTime: new Date(start.getTime() + 3600_000).toISOString(), allDay: false, createdBy: getSeededParentId() },
    });
    expect(ev.status()).toBe(201);
    const id = (await ev.json()).id;
    try {
      await page.addInitScript(() => localStorage.setItem('prism-calendar-view-type', 'agenda'));
      await page.goto('/calendar');
      const words = page.locator('[data-agenda-day-word]');
      await expect(words.filter({ hasText: /^Tomorrow$/ })).toHaveCount(1, { timeout: 60_000 });
      for (const w of await words.allTextContents()) {
        expect(w, 'a word, not a full date').toMatch(/^[A-Za-z]+$/);
      }
      const sizes = await words.first().evaluate((e) => ({
        word: parseFloat(getComputedStyle(e).fontSize),
        date: parseFloat(getComputedStyle(e.nextElementSibling!).fontSize),
      }));
      expect(sizes.word).toBeGreaterThan(sizes.date);
      const text = await smallestText(page);
      expect(text.min, `smallest text "${text.where}"`).toBeGreaterThanOrEqual(text.floor);
    } finally {
      await page.request.delete(`/api/events/${id}`);
    }
  });
});
