import { test, expect, type Page } from '@playwright/test';
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
    localStorage.setItem('prism-calendar-week-count', '2');
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
        // The "+N more" trigger is not one of the day's cards: it is a wider
        // control with its own padding, and on a day whose events have all
        // collapsed into it, it is the only button left in the cell. Measuring
        // a band title against it compared two unrelated boxes.
        const card = [...cell.querySelectorAll('button')].find(
          (b) => !b.closest('[data-spanning-events]') && !b.hasAttribute('data-day-overflow') && b.textContent?.trim());
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
          (b) => !b.closest('[data-spanning-events]') && !b.hasAttribute('data-day-overflow'));
        if (!cards.length) continue;
        const cardHeight = Math.max(...cards.map((c) => c.getBoundingClientRect().height));
        // Anything pinned to the bottom of the cell (the meals/chores overlay)
        // is not free space, so measure up to whichever comes first.
        const floors = [...cell.querySelectorAll('.mt-auto')].map((o) => o.getBoundingClientRect().top);
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
