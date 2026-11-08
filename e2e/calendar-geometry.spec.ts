import { test, expect, type Page, type TestInfo, type BrowserType } from '@playwright/test';
import { getSeededParentId } from './helpers/auth';

/**
 * Geometry checks for the calendar grid.
 *
 * Every calendar bug in this area has been geometric — a lane two pixels out, a
 * stripe stopping short of its card, a title starting four pixels left of the
 * titles beneath it, a continuation slice collapsing to a sliver. None of them
 * can fail a unit test: the classes and props were correct every time and the
 * rendered boxes were not. These assert the boxes.
 */

/**
 * CI runs against a freshly seeded database with no display user configured, so
 * an anonymous /calendar renders an empty grid and there is nothing to measure.
 * A dev instance already has one, and its real PIN is not 1234, so the login
 * sits behind the same flag every database-dependent spec uses. Guessing PINs
 * against a live deployment trips the lockout.
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const PIN = process.env.E2E_PIN || '1234';

async function openCalendar(page: Page, mode: 'cards' | 'inline', view = 'multiWeek') {
  if (HAS_TEST_DB) {
    const login = await page.request.post('/api/auth/login', {
      data: { userId: getSeededParentId(), pin: PIN },
    });
    expect(login.ok(), 'precondition: login must succeed before measuring').toBe(true);
  }
  await page.addInitScript(([m, v]) => {
    localStorage.setItem('prism-calendar-view-type', v as string);
    localStorage.setItem('prism-calendar-display-mode', m as string);
    localStorage.setItem('prism-calendar-bordered', 'true');
  }, [mode, view]);
  await page.goto('/calendar', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-spanning-events]', { timeout: 30000 });
  await page.waitForTimeout(1500);
}

test.describe('calendar grid geometry', () => {
  test('a colour stripe spans its row, edge to edge', async ({ page }) => {
    await openCalendar(page, 'cards');
    const rows = await page.evaluate(() => {
      const out: Array<{ kind: string; row: number; stripe: number; border: number }> = [];
      const collect = (el: Element, kind: string) => {
        const stripe = el.querySelector('span[aria-hidden]');
        if (!stripe) return;
        const r = el.getBoundingClientRect();
        const s = stripe.getBoundingClientRect();
        if (!r.height || !s.width) return;
        const cs = getComputedStyle(el);
        out.push({
          kind, row: +r.height.toFixed(1), stripe: +s.height.toFixed(1),
          border: parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth),
        });
      };
      document.querySelectorAll('[data-spanning-events] > *').forEach((el) => collect(el, 'band'));
      document.querySelectorAll('[data-droppable-day] button, .relative button').forEach((el) => {
        // The person filter chips (#879) carry a dot, not a stripe: not event cards.
        if (!el.closest('[data-spanning-events]') && !el.closest('[data-calendar-filter]')) collect(el, 'card');
      });
      return out;
    });

    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      // The stripe fills the row's inner height so the container's rounded
      // corner masks it. Anything short leaves a gap at top and bottom.
      expect(Math.abs(r.stripe - (r.row - r.border))).toBeLessThanOrEqual(1);
    }
  });

  test('band titles and card titles start at the same offset', async ({ page }) => {
    // Its own pair (#1102): a two-day event and a single one on its first day,
    // tomorrow, so a cell with both is always in view. The seed's events move
    // with the date and some days left no such cell.
    const created: string[] = [];
    if (HAS_TEST_DB) {
      expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
      const now = new Date();
      // 10:00 and 12:00 UTC fall on the same date in Tokyo and Chicago.
      const day = (d: number, h: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + d, h)).toISOString();
      for (const data of [
        { title: 'Band e2e span', startTime: day(1, 10), endTime: day(3, 10) },
        { title: 'Band e2e card', startTime: day(1, 12), endTime: day(1, 13) },
      ]) {
        const res = await postEvent(page, { ...data, allDay: false, createdBy: getSeededParentId() });
        expect(res.status()).toBe(201);
        created.push((await res.json()).id);
      }
    }
    // Tall enough that the day's card is drawn, not folded into "+N more" on a
    // day the seed also fills. Alignment does not depend on the screen's size.
    await page.setViewportSize({ width: 1920, height: 2400 });
    try {
    await openCalendar(page, 'cards');
    const offsets = await page.evaluate(() => {
      const textLeft = (el: Element) => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let n: Node | null;
        while ((n = walker.nextNode())) {
          if (!n.textContent?.trim()) continue;
          const range = document.createRange();
          range.selectNode(n);
          return +range.getBoundingClientRect().left.toFixed(1);
        }
        return null;
      };
      // Everything a failure needs in order to name the two boxes it measured.
      // Without this the report is a bare pair of numbers, and diagnosing it
      // means guessing which elements produced them.
      const describe = (el: Element) => {
        const cs = getComputedStyle(el);
        return {
          text: (el.textContent || '').trim().slice(0, 30),
          cls: el.className.toString().slice(0, 120),
          left: +el.getBoundingClientRect().left.toFixed(1),
          padL: cs.paddingLeft,
          borderL: cs.borderLeftWidth,
        };
      };
      const out: Array<Record<string, unknown>> = [];
      document.querySelectorAll('[data-spanning-events]').forEach((band) => {
        const cell = band.parentElement!;
        const slice = [...band.children].find((e) => e.getBoundingClientRect().width && e.textContent?.trim());
        // Two things in a cell are not the day's event cards and must not be
        // measured against a band title:
        //   - the "+N more" trigger, a wider control with its own padding, and
        //     the only button left on a day whose events all collapsed into it;
        //   - the meals/chores planning group, which is deliberately inset
        //     inside its own band (p-1.5), so its cards sit 5.25px in.
        // Both were read as misalignment, and which one a run hit depended on
        // the date, so the suite passed or failed with the calendar.
        const card = [...cell.querySelectorAll('button')].find(
          (b) => !b.closest('[data-spanning-events]')
            && !b.closest('[data-day-overlay]')
            && !b.hasAttribute('data-day-overflow')
            && b.textContent?.trim());
        if (slice && card) {
          out.push({
            band: textLeft(slice), card: textLeft(card),
            slice: describe(slice), cardEl: describe(card),
          });
        }
      });
      return out;
    });

    // What the page drew, so a run that finds no pair says why (#1102).
    const seen = offsets.length ? '' : await page.evaluate(() => JSON.stringify({
      url: location.pathname,
      viewport: [innerWidth, innerHeight],
      bands: [...document.querySelectorAll('[data-spanning-events]')].map((b) => (b.textContent || '').trim().slice(0, 40)).slice(0, 8),
      ours: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').trim()).filter((t) => t.includes('Band e2e')),
      folds: document.querySelectorAll('[data-day-overflow]').length,
    }));
    expect(offsets.length, `no cell with both a band and a card: ${seen}`).toBeGreaterThan(0);
    const misaligned = offsets.filter(
      (o) => Math.abs((o.band as number) - (o.card as number)) > 0.5);
    expect(misaligned, `misaligned band/card pairs:\n${JSON.stringify(misaligned, null, 1)}`).toEqual([]);
    } finally {
      for (const id of created) await page.request.delete(`/api/events/${id}`);
    }
  });

  test('a lane sits at the same height in every column of a row', async ({ page }) => {
    await openCalendar(page, 'cards');
    const lanes = await page.evaluate(() => {
      const byLane = new Map<string, number[]>();
      document.querySelectorAll('[data-spanning-events]').forEach((band) => {
        const bandTop = Math.round(band.getBoundingClientRect().top);
        [...band.children].forEach((el, lane) => {
          const r = el.getBoundingClientRect();
          if (!r.width) return;
          const key = `${bandTop}:${lane}`;
          const list = byLane.get(key) ?? [];
          list.push(+r.top.toFixed(1));
          byLane.set(key, list);
        });
      });
      return [...byLane.entries()].map(([key, tops]) => ({ key, spread: Math.max(...tops) - Math.min(...tops) }));
    });

    expect(lanes.length).toBeGreaterThan(0);
    // A lane that drifts between columns makes a multi-day bar step mid-run.
    for (const l of lanes) expect(l.spread).toBeLessThanOrEqual(1);
  });

  test('no slice is a sliver: every visible row has a real line box', async ({ page }) => {
    await openCalendar(page, 'cards');
    const heights = await page.evaluate(() =>
      [...document.querySelectorAll('[data-spanning-events] > *')]
        .map((el) => +el.getBoundingClientRect().height.toFixed(1))
        .filter((h) => h > 0));

    expect(heights.length).toBeGreaterThan(0);
    // A continuation carries no title; without a reserved line box it collapses
    // to its padding and the event looks like it stopped after its first day.
    for (const h of heights) expect(h).toBeGreaterThan(12);
  });

  test('a day only says "+N more" when it has genuinely run out of room', async ({ page }) => {
    await openCalendar(page, 'cards');
    const cells = await page.evaluate(() => {
      const out: Array<{ label: string; free: number; cardHeight: number }> = [];
      // Matching the label text found nothing on a non-English instance, so the
      // assertion below quietly measured zero cells instead of failing.
      const triggers = [...document.querySelectorAll('[data-day-overflow]')];
      for (const trigger of triggers) {
        const cell = trigger.closest('[data-droppable-day]') ?? trigger.closest('div.relative.flex.flex-col');
        if (!cell) continue;
        const cards = [...cell.querySelectorAll('button')].filter(
          (b) => !b.closest('[data-spanning-events]')
            && !b.closest('[data-day-overlay]')
            && !b.hasAttribute('data-day-overflow'));
        if (!cards.length) continue;
        const cardHeight = Math.max(...cards.map((c) => c.getBoundingClientRect().height));
        // Anything pinned to the bottom of the cell (the meals/chores overlay)
        // is not free space, so measure up to whichever comes first.
        const floors = [...cell.querySelectorAll('[data-day-overlay], .mt-auto')]
          .map((o) => o.getBoundingClientRect().top);
        const floor = Math.min(cell.getBoundingClientRect().bottom, ...floors);
        out.push({
          label: (trigger.textContent || '').trim(),
          free: +(floor - trigger.getBoundingClientRect().bottom).toFixed(1),
          cardHeight: +cardHeight.toFixed(1),
        });
      }
      return out;
    });

    // Nothing to assert on a quiet week; the check is meaningful only when a
    // day actually overflows.
    for (const c of cells) {
      // Capacity is driven by a probe that measures a sample card. If the probe
      // renders a taller card than the view does, every event is over-costed
      // and a day hides events while the space to show them sits empty.
      expect(c.free).toBeLessThan(c.cardHeight);
    }
  });
});

/**
 * Text floor (#798): no text in a calendar view, or in the calendar widget
 * under page and widget zoom, renders smaller than 14px on a wall screen or
 * 12px at a desk. Measured as the rendered size: computed font-size times the
 * CSS zoom in force, for every visible text node on screen.
 *
 * 3 Months is in since #894: its compact events draw at the floor and a busy
 * day folds the rest into "+N" (see the test below). The calendar widget has no
 * 3 Months view, so WIDGET_VIEWS does not list it.
 */
const FLOOR_VIEWS = ['agenda', 'day', 'week', 'weekVertical', 'multiWeek', 'month', 'threeMonth'];
const WIDGET_VIEWS = ['agenda', 'list', 'day', 'week', 'multiWeek2', 'month'];
const POINTERS = [
  // Blink bitmask: none=1, fine=4. Set at launch; CDP emulation is ignored.
  { name: 'wall (no pointer)', bits: 1, media: '(pointer: none)', floor: 14 },
  { name: 'desk (mouse)', bits: 4, media: '(pointer: fine)', floor: 12 },
];

/** Every visible text node on screen drawn under `floor` px, and how many were measured. */
async function textUnder(page: Page, floor: number, within?: string) {
  return page.evaluate(([min, sel]) => {
    const root = sel ? document.querySelector(sel) : document.body;
    if (!root) return { count: 0, under: [] as Array<{ px: number; text: string; cls: string }> };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const seen = new Set<Element>();
    const under: Array<{ px: number; text: string; cls: string }> = [];
    let count = 0;
    let n: Node | null;
    while ((n = walker.nextNode())) {
      if (!n.textContent?.trim()) continue;
      const el = n.parentElement;
      if (!el || seen.has(el)) continue;
      seen.add(el);
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.opacity === '0') continue;
      count++;
      const px = parseFloat(cs.fontSize) * (el.currentCSSZoom || 1);
      // 0.05 px of slack for rounding through zoom.
      if (px < (min as number) - 0.05) {
        under.push({ px: Math.round(px * 10) / 10, text: n.textContent.trim().slice(0, 30), cls: (el.getAttribute('class') || '').slice(0, 80) });
      }
    }
    return { count, under };
  }, [floor, within] as const);
}

/**
 * A page in a browser launched with the given pointer type. Playwright sets
 * launch options only per worker, and CDP pointer emulation is ignored.
 */
async function pointerPage(
  playwright: { chromium: BrowserType },
  info: TestInfo,
  bits: number,
  viewport: { width: number; height: number },
) {
  const browser = await playwright.chromium.launch({
    args: [`--blink-settings=primaryPointerType=${bits},availablePointerTypes=${bits}`],
  });
  const context = await browser.newContext({ viewport, baseURL: info.project.use.baseURL, timezoneId: info.project.use.timezoneId });
  return { browser, page: await context.newPage() };
}

/**
 * Create an event, waiting out the per-user rate limit (30 a minute). Both
 * browser projects create events for the same seeded parent at about the same
 * time, so a run can hit the limit through no fault of the code under test.
 */
async function postEvent(page: Page, data: Record<string, unknown>) {
  for (let attempt = 0; ; attempt++) {
    const res = await page.request.post('/api/events', { data });
    if (res.status() !== 429 || attempt >= 3) return res;
    const wait = Number(res.headers()['retry-after'] ?? '20');
    await page.waitForTimeout(Math.min(Math.max(wait, 1), 65) * 1000);
  }
}

/**
 * A day this month for a test to fill with its own events, clear of anything
 * the seed put near it. The seed places events relative to the day it runs, so
 * a fixed date (the 12th) collided with them some days and the busy day held
 * more than the test made (#1102). Days far from today come first, and one is
 * taken only if no seeded event touches that date in any zone CI uses: Tokyo's
 * day starts at 15:00 UTC the day before, Chicago's ends at 06:00 UTC the day
 * after. Returns the day of the month.
 */
async function quietDay(page: Page, now: Date): Promise<number> {
  const y = now.getFullYear();
  const m = now.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  const from = new Date(Date.UTC(y, m, 1) - 2 * 86_400_000).toISOString();
  const to = new Date(Date.UTC(y, m, last) + 3 * 86_400_000).toISOString();
  const res = await page.request.get(`/api/events?startDate=${from}&endDate=${to}&limit=5000`);
  expect(res.ok(), 'premise: the events list loads').toBe(true);
  const body = await res.json();
  const events: Array<{ startTime: string; endTime?: string }> = body.events ?? body;
  const busy = (d: number) => {
    const a = Date.UTC(y, m, d - 1, 15);
    const b = Date.UTC(y, m, d + 1, 6);
    return events.some((e) => {
      const s = new Date(e.startTime).getTime();
      const t = new Date(e.endTime ?? e.startTime).getTime();
      return s < b && t > a;
    });
  };
  const today = now.getDate();
  const days = Array.from({ length: last - 3 }, (_, i) => i + 2).sort((p, q) => Math.abs(q - today) - Math.abs(p - today));
  const day = days.find((d) => !busy(d));
  expect(day, 'premise: some day this month is free of seeded events').toBeDefined();
  return day!;
}

async function openCalendarView(page: Page, view: string) {
  if (HAS_TEST_DB) {
    const login = await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } });
    expect(login.ok(), 'precondition: login must succeed before measuring').toBe(true);
  }
  await page.addInitScript((v) => localStorage.setItem('prism-calendar-view-type', v), view);
  await page.goto('/calendar', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Add Event' }).waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1500);
}

for (const pointer of POINTERS) {
  test.describe(`text floor, ${pointer.name}`, () => {
    for (const [width, height] of [[1920, 1080], [1280, 720]] as const) {
      test(`calendar views at ${width}x${height} never draw text under ${pointer.floor}px`, async ({ playwright }, info) => {
        test.setTimeout(180_000);
        const { browser, page } = await pointerPage(playwright, info, pointer.bits, { width, height });
        try {
          for (const view of FLOOR_VIEWS) {
            await openCalendarView(page, view);
            expect(await page.evaluate((m) => matchMedia(m).matches, pointer.media), `premise: ${pointer.media}`).toBe(true);
            const { count, under } = await textUnder(page, pointer.floor);
            expect(count, `${view}: something to measure`).toBeGreaterThan(10);
            expect(under, `${view}: text under ${pointer.floor}px`).toEqual([]);
          }
        } finally {
          await browser.close();
        }
      });
    }

    test(`calendar widget at 75% page zoom and 0.5 widget zoom never draws text under ${pointer.floor}px`, async ({ playwright }, info) => {
      test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a fresh-seeded DB');
      test.setTimeout(180_000);
      const { browser, page } = await pointerPage(playwright, info, pointer.bits, { width: 1920, height: 1080 });
      const login = await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } });
      expect(login.ok(), 'precondition: login must succeed').toBe(true);
      const created = await page.request.post('/api/layouts', {
        data: {
          name: `Text floor e2e ${Date.now()}`,
          widgets: [{ i: 'calendar', x: 0, y: 0, w: 32, h: 32, textScale: 0.5 }],
        },
      });
      expect(created.status()).toBe(201);
      const layout = await created.json();
      try {
        const zoomed = await page.request.patch(`/api/layouts/${layout.id}`, { data: { fontScale: 75 } });
        expect(zoomed.ok(), 'precondition: page zoom saved').toBe(true);
        for (const view of WIDGET_VIEWS) {
          await page.addInitScript((v) => localStorage.setItem('prism-calendar-view', v), view);
          await page.goto(`/d/${layout.slug}`, { waitUntil: 'networkidle' });
          const cell = page.locator('.widget-cell[data-widget="calendar"]');
          await cell.waitFor({ timeout: 60_000 });
          await page.waitForTimeout(1500);
          const zoom = await cell.evaluate((el) => {
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) if (walker.currentNode.textContent?.trim()) return walker.currentNode.parentElement!.currentCSSZoom;
            return 1;
          });
          expect(zoom, 'premise: page and widget zoom both apply').toBeCloseTo(0.375, 2);
          const { count, under } = await textUnder(page, pointer.floor, '.widget-cell[data-widget="calendar"]');
          expect(count, `${view}: something to measure`).toBeGreaterThan(3);
          expect(under, `${view}: text under ${pointer.floor}px`).toEqual([]);
        }
      } finally {
        await page.request.delete(`/api/layouts/${layout.id}`);
        await browser.close();
      }
    });
  });
}

/**
 * 3 Months at the floor (#894). A day cell there is about 82x145 at 1080p and
 * 52x79 at 720p, so at 14px only a few events fit. A busy day must show what
 * fits and fold the rest into "+N", never spill out of the cell, never scroll
 * inside it, and never fold while there is room for another event.
 */
test.describe('3 Months folds a busy day', () => {
  test('at 1080p and 720p a busy day shows "+N" and keeps every event inside its cell', async ({ playwright }, info) => {
    test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a fresh-seeded DB');
    test.setTimeout(180_000);
    const parentId = getSeededParentId();
    // One set of events for both sizes: creating events is rate limited per user.
    const { browser, page } = await pointerPage(playwright, info, 1, { width: 1920, height: 1080 });
    const login = await page.request.post('/api/auth/login', { data: { userId: parentId, pin: PIN } });
    expect(login.ok(), 'precondition: login must succeed').toBe(true);
    // A day of the current month is always in the middle mini month. Six is
    // more than a 1080p cell holds (four) and needs no other events that day.
    const now = new Date();
    const dom = await quietDay(page, now);
    const busyDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(dom).padStart(2, '0')}`;
    const created: string[] = [];
    try {
      for (let i = 0; i < 6; i++) {
        // In UTC, 07:00-12:30 on a day is that day in every zone CI uses: the
        // runner and server in Tokyo, the browser in Chicago or Tokyo.
        const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), dom, 7 + i));
        const res = await postEvent(page, {
          title: `Busy day e2e ${i + 1}`,
          startTime: start.toISOString(),
          endTime: new Date(start.getTime() + 30 * 60_000).toISOString(),
          allDay: false,
          createdBy: parentId,
        });
        expect(res.status()).toBe(201);
        created.push((await res.json()).id);
      }
      for (const [width, height] of [[1920, 1080], [1280, 720]] as const) {
        await page.setViewportSize({ width, height });
        await openCalendarView(page, 'threeMonth');
        // Found by date, not by title: at 720p the cell shows one event, and a
        // seeded event that sorts first (all-day, or earlier) may take that spot.
        const day = page.locator(`[data-three-month-day="${busyDate}"]`);
        await expect(day, `${width}x${height}: the busy day`).toHaveCount(1);
        // The cell is drawn before its events arrive: wait for the fold, or
        // the measurement can run on an empty day.
        await expect(day.locator('[data-day-overflow]'), `${width}x${height}: the busy day folds`).toBeVisible();
        const box = await day.evaluate((cell) => {
          const r = cell.getBoundingClientRect();
          const chips = [...cell.querySelectorAll('li button')].map((b) => b.getBoundingClientRect());
          const trigger = cell.querySelector('[data-day-overflow]');
          const t = trigger?.getBoundingClientRect();
          const list = trigger?.parentElement?.parentElement?.getBoundingClientRect();
          return {
            label: trigger?.textContent?.trim() ?? null,
            name: trigger?.getAttribute('aria-label') ?? null,
            triggerFont: trigger ? parseFloat(getComputedStyle(trigger).fontSize) : 0,
            chips: chips.length,
            chipHeight: chips.length ? Math.max(...chips.map((c) => c.height)) : 0,
            spill: [...chips, ...(t ? [t] : [])].filter((c) => c.bottom > r.bottom + 0.5 || c.right > r.right + 0.5).length,
            free: t && list ? list.bottom - t.bottom : 0,
          };
        });
        const at = `${width}x${height}`;
        expect(box.label, `${at}: a busy day folds into +N`).toMatch(/^\+\d+$/);
        expect(box.name, `${at}: the short label keeps its full accessible name`).toMatch(/\d/);
        expect(box.triggerFont, `${at}: +N at the floor`).toBeGreaterThanOrEqual(13.95);
        expect(box.spill, `${at}: nothing drawn past the cell`).toBe(0);
        // Shown plus folded is every event that day (6 added, plus any seeded).
        expect(box.chips + Number(box.label!.slice(1))).toBeGreaterThanOrEqual(6);
        // Folding only when out of room: the space left under the trigger is
        // less than one more event would need.
        if (box.chips > 0) expect(box.free, `${at}: folded with room to spare`).toBeLessThan(box.chipHeight);
      }
    } finally {
      for (const id of created) await page.request.delete(`/api/events/${id}`);
      await browser.close();
    }
  });
});

/**
 * Busy days page on the wall (#801). On a dashboard calendar widget at wall
 * width, a day with more events than fit shows a page of them with a "1/N"
 * label and turns the page every 8 seconds, so every event gets on screen
 * without anyone tapping. Checked in both display modes, since inline is the
 * widget's default and cards is the other. The Calendar page keeps "+N more".
 */
test.describe('busy days page on the wall', () => {
  test('a busy day in the widget pages through every event; the Calendar page still folds', async ({ playwright }, info) => {
    test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a fresh-seeded DB');
    test.setTimeout(240_000);
    const parentId = getSeededParentId();
    const { browser, page } = await pointerPage(playwright, info, 1, { width: 1920, height: 1080 });
    const login = await page.request.post('/api/auth/login', { data: { userId: parentId, pin: PIN } });
    expect(login.ok(), 'precondition: login must succeed').toBe(true);
    // A day of the current month is always in the month grid. Each project
    // runs in parallel against one database, so the titles carry its name.
    const now = new Date();
    const dom = await quietDay(page, now);
    const busyDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(dom).padStart(2, '0')}`;
    const tag = info.project.name;
    // Five: more than a 1080p day holds in either mode (two inline, three as
    // cards), so it pages, and few enough to stay clear of the rate limit.
    const titles = Array.from({ length: 5 }, (_, i) => `Paged e2e ${tag} ${i + 1}`);
    const created: string[] = [];
    const layout = await (await page.request.post('/api/layouts', {
      data: { name: `Paging e2e ${Date.now()}`, widgets: [{ i: 'calendar', x: 0, y: 0, w: 32, h: 32 }] },
    })).json();
    try {
      for (const [i, title] of titles.entries()) {
        // 06:00-10:30 UTC on a day is that day in every zone CI uses (Tokyo, Chicago).
        const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), dom, 6 + i));
        const res = await postEvent(page, { title, startTime: start.toISOString(), endTime: new Date(start.getTime() + 30 * 60_000).toISOString(), allDay: false, createdBy: parentId });
        expect(res.status()).toBe(201);
        created.push((await res.json()).id);
      }
      await page.clock.install({ time: now });
      for (const mode of ['inline', 'cards'] as const) {
        await page.addInitScript((m) => {
          localStorage.setItem('prism-calendar-view', 'month');
          localStorage.setItem('prism-calendar-display-mode', m);
        }, mode);
        // Every request settled before the pages are counted: a meal or a chore
        // for that day arriving later added a page mid-test (#1102).
        await page.goto(`/d/${layout.slug}`, { waitUntil: 'networkidle' });
        const day = page.locator(`.widget-cell[data-widget="calendar"] [data-month-day="${busyDate}"]`);
        const label = day.locator('[data-day-page]');
        await expect(label, `${mode}: the busy day pages`).toHaveAttribute('data-day-page', /^1\/\d+$/, { timeout: 60_000 });
        const pages = Number((await label.getAttribute('data-day-page'))!.split('/')[1]);
        expect(pages, `${mode}: more than one page`).toBeGreaterThan(1);
        const seen = new Set<string>();
        for (let p = 1; p <= pages; p++) {
          await expect(label, `${mode}: page ${p}`).toHaveAttribute('data-day-page', `${p}/${pages}`);
          const shot = await day.evaluate((cell) => {
            const r = cell.getBoundingClientRect();
            const rows = [...cell.querySelectorAll('button')].filter((b) => /Paged e2e/.test(b.textContent ?? ''));
            return {
              titles: rows.map((b) => (b.textContent ?? '').replace(/^.*?(Paged e2e)/, '$1').trim()),
              spill: rows.filter((b) => { const x = b.getBoundingClientRect(); return x.bottom > r.bottom + 0.5 || x.right > r.right + 0.5; }).length,
            };
          });
          expect(shot.spill, `${mode} page ${p}: nothing drawn past the cell`).toBe(0);
          for (const t of shot.titles) seen.add(t);
          await page.clock.runFor(8_000);
        }
        expect(await label.getAttribute('data-day-page'), `${mode}: wraps to the first page`).toBe(`1/${pages}`);
        for (const t of titles) expect([...seen].some((s) => s.startsWith(t)), `${mode}: "${t}" was on a page`).toBe(true);
      }
      // The Calendar page keeps "+N more": tapping is quicker there.
      await openCalendarView(page, 'month');
      const pageDay = page.locator(`[data-month-day="${busyDate}"]`);
      await expect(pageDay.locator('[data-day-overflow]')).toBeVisible();
      await expect(pageDay.locator('[data-day-page]')).toHaveCount(0);
    } finally {
      for (const id of created) await page.request.delete(`/api/events/${id}`);
      await page.request.delete(`/api/layouts/${layout.id}`);
      await browser.close();
    }
  });
});

/**
 * Now & Next (#806). The page clock is fixed at 12:00 UTC on a far date, and
 * the events sit around it, so "today" is one day in any zone CI uses (UTC,
 * Chicago) and the countdown is exact. Measured on a wall screen at 1080p:
 * the lines say what is on and what is next, nothing is under the floor and
 * nothing is drawn outside the widget.
 */
test.describe('Now & Next widget', () => {
  test('shows the event in progress, the next one with its countdown, at the floor', async ({ playwright }, info) => {
    test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a fresh-seeded DB');
    test.setTimeout(120_000);
    const { browser, page } = await pointerPage(playwright, info, 1, { width: 1920, height: 1080 });
    const parentId = getSeededParentId();
    const login = await page.request.post('/api/auth/login', { data: { userId: parentId, pin: PIN } });
    expect(login.ok(), 'precondition: login must succeed').toBe(true);
    const T = new Date('2028-03-15T12:00:00Z');
    const at = (min: number) => new Date(T.getTime() + min * 60_000).toISOString();
    const created: string[] = [];
    // Each project runs in parallel against one database: own titles.
    const tag = `${info.project.name} ${Date.now()}`;
    const nowTitle = `Now e2e lesson ${tag}`;
    const nextTitle = `Next e2e practice ${tag}`;
    const layout = await (await page.request.post('/api/layouts', {
      data: { name: `Now next e2e ${Date.now()}`, widgets: [{ i: 'nowNext', x: 0, y: 0, w: 24, h: 8 }] },
    })).json();
    try {
      for (const [title, start, end] of [[nowTitle, -20, 40], [nextTitle, 90, 150]] as const) {
        const res = await postEvent(page, { title, startTime: at(start), endTime: at(end), allDay: false, createdBy: parentId });
        expect(res.status()).toBe(201);
        created.push((await res.json()).id);
      }
      await page.clock.setFixedTime(T);
      await page.goto(`/d/${layout.slug}`, { waitUntil: 'load' });
      const cell = page.locator('.widget-cell[data-widget="nowNext"]');
      await expect(cell.locator('[data-now-next="now"]', { hasText: nowTitle })).toBeVisible({ timeout: 60_000 });
      // The other project's events can be on too; the next one is still ours
      // or its twin, both 90 minutes out.
      await expect(cell.locator('[data-now-next="next"]')).toContainText('Next e2e practice');
      await expect(cell.locator('[data-now-next="next"]')).toContainText('in 1 h 30 min');
      const { count, under } = await textUnder(page, 14, '.widget-cell[data-widget="nowNext"]');
      expect(count).toBeGreaterThan(3);
      expect(under, 'Now & Next text under 14px').toEqual([]);
      const spill = await cell.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return [...el.querySelectorAll('[data-now-next]')].filter((l) => {
          const b = l.getBoundingClientRect();
          return b.bottom > r.bottom + 0.5 || b.right > r.right + 0.5;
        }).length;
      });
      expect(spill, 'lines drawn outside the widget').toBe(0);
    } finally {
      for (const id of created) await page.request.delete(`/api/events/${id}`);
      await page.request.delete(`/api/layouts/${layout.id}`);
      await browser.close();
    }
  });
});

/**
 * The clock fits its tile (#808 hero). A tablet is a touch screen at 1180px, so
 * it gets the 20px wall root; at that size "4:10 PM" in a small tile wrapped
 * onto two lines and the date ran out of the box. The clock now sizes from its
 * own box, so the time stays on one line and both lines stay inside the tile.
 */
test.describe('clock fits its tile', () => {
  for (const [label, viewport] of [
    ['tablet', { width: 1180, height: 820 }],
    ['wall', { width: 1920, height: 1080 }],
  ] as const) {
    test(`a small clock tile on a ${label} holds the time on one line and the date inside`, async ({ playwright }, info) => {
      test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a fresh-seeded DB');
      test.setTimeout(120_000);
      // Blink bitmask: coarse=2, as a tablet reports.
      const { browser, page } = await pointerPage(playwright, info, 2, viewport);
      const login = await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } });
      expect(login.ok(), 'precondition: login must succeed').toBe(true);
      const created = await page.request.post('/api/layouts', {
        data: {
          name: `Clock fit e2e ${Date.now()}`,
          // About the hero's tablet tile (some 210px wide), where it overflowed.
          widgets: [
            { i: 'calendar', x: 0, y: 0, w: 24, h: 27 },
            { i: 'clock', x: 24, y: 19, w: 7, h: 8 },
          ],
        },
      });
      expect(created.status()).toBe(201);
      const layout = await created.json();
      try {
        await page.goto(`/d/${layout.slug}`, { waitUntil: 'networkidle' });
        const cell = page.locator('.widget-cell[data-widget="clock"]');
        await cell.waitFor({ timeout: 60_000 });
        await page.waitForTimeout(1000);
        expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), 'premise: coarse pointer').toBe(true);
        const m = await cell.evaluate((el) => {
          const box = el.getBoundingClientRect();
          const [time, date] = (['[data-clock-time]', '[data-clock-date]'] as const).map((sel) => {
            const t = el.querySelector(sel)!;
            const r = t.getBoundingClientRect();
            const cs = getComputedStyle(t);
            return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, height: r.height, line: parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2, weight: cs.fontWeight };
          });
          return { box: { left: box.left, right: box.right, top: box.top, bottom: box.bottom }, time: time!, date: date! };
        });
        expect(m.time.height, 'time is one line').toBeLessThan(m.time.line * 1.5);
        // A lock screen (#800): the date sits above the time, which is medium weight.
        expect(m.date.bottom, 'date above the time').toBeLessThanOrEqual(m.time.top + 0.5);
        expect(m.time.weight, 'time at medium weight').toBe('500');
        for (const [name, r] of [['time', m.time], ['date', m.date]] as const) {
          expect(r.left, `${name} inside on the left`).toBeGreaterThanOrEqual(m.box.left - 0.5);
          expect(r.right, `${name} inside on the right`).toBeLessThanOrEqual(m.box.right + 0.5);
          expect(r.top, `${name} inside at the top`).toBeGreaterThanOrEqual(m.box.top - 0.5);
          expect(r.bottom, `${name} inside at the bottom`).toBeLessThanOrEqual(m.box.bottom + 0.5);
        }
      } finally {
        await page.request.delete(`/api/layouts/${layout.id}`);
        await browser.close();
      }
    });
  }
});
