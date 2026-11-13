import { test, expect } from '@playwright/test';

// The Screenshots page (#1144): each tab shows one screen at a time, large,
// in a strip that scrolls sideways and snaps, with the next one peeking in.
// Nothing on the page scrolls the page itself sideways.

for (const [label, width, height] of [
  ['desktop', 1280, 800],
  ['phone', 390, 844],
] as const) {
  test(`${label}: one screen at a time, scrolled sideways`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/screenshots/');
    const strip = page.locator('.tabbed-block').first().locator('.shot-strip');
    await expect(strip).toBeVisible();
    const m = await strip.evaluate((el) => {
      const figs = [...el.querySelectorAll(':scope > figure')].map((f) => f.getBoundingClientRect().toJSON());
      const r = el.getBoundingClientRect();
      return {
        snap: getComputedStyle(el).scrollSnapType, scrolls: el.scrollWidth > el.clientWidth + 1,
        stripW: r.width, stripRight: r.right, figs,
        img: el.querySelector('img')!.getBoundingClientRect().width,
        caption: el.querySelector('figcaption')?.textContent?.trim() ?? '',
      };
    });
    expect(m.snap).toContain('x');
    expect(m.scrolls).toBe(true);
    expect(m.figs.length).toBeGreaterThanOrEqual(3);
    // The first fills most of the strip, and the second starts inside it, so it peeks in.
    expect(m.figs[0]!.width).toBeGreaterThanOrEqual(m.stripW * 0.8);
    expect(m.img).toBeGreaterThanOrEqual(m.stripW * 0.8);
    expect(m.figs[1]!.left).toBeLessThan(m.stripRight);
    expect(m.caption.length).toBeGreaterThan(0);

    // Scrolling the strip brings the next screen to its start.
    await strip.evaluate((el) => el.scrollBy({ left: el.clientWidth, behavior: 'instant' as ScrollBehavior }));
    await expect.poll(() => strip.evaluate((el) => {
      const s = el.getBoundingClientRect().left;
      return Math.round(el.querySelectorAll(':scope > figure')[1]!.getBoundingClientRect().left - s);
    })).toBeLessThanOrEqual(1);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
