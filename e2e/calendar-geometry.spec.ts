import { test, expect, type Page, type TestInfo, type BrowserType } from '@playwright/test';
import { getSeededParentId } from './helpers/auth';
import { waitForQuiet } from './helpers/network';

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
  await page.goto('/calendar');
  await waitForQuiet(page);
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
        if (!el.closest('[data-spanning-events]')) collect(el, 'card');
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

    expect(offsets.length).toBeGreaterThan(0);
    const misaligned = offsets.filter(
      (o) => Math.abs((o.band as number) - (o.card as number)) > 0.5);
    expect(misaligned, `misaligned band/card pairs:\n${JSON.stringify(misaligned, null, 1)}`).toEqual([]);
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
 * 3 Months is left out until its compact events are reworked (the dense views
 * part of #798); it still draws events at 8px.
 */
const FLOOR_VIEWS = ['agenda', 'day', 'week', 'weekVertical', 'multiWeek', 'month'];
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

async function openCalendarView(page: Page, view: string) {
  if (HAS_TEST_DB) {
    const login = await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } });
    expect(login.ok(), 'precondition: login must succeed before measuring').toBe(true);
  }
  await page.addInitScript((v) => localStorage.setItem('prism-calendar-view-type', v), view);
  await page.goto('/calendar');
  await waitForQuiet(page);
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
          await page.goto(`/d/${layout.slug}`);
  await waitForQuiet(page);
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
          const [time, date] = Array.from(el.querySelectorAll('time'), (t) => {
            const r = t.getBoundingClientRect();
            const cs = getComputedStyle(t);
            return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, height: r.height, line: parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2 };
          });
          return { box: { left: box.left, right: box.right, top: box.top, bottom: box.bottom }, time: time!, date: date! };
        });
        expect(m.time.height, 'time is one line').toBeLessThan(m.time.line * 1.5);
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
