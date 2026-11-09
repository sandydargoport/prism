import { test, expect, type Page } from '@playwright/test';

// The docs site front page (overrides/home.html, #1120). Measures what a
// visitor sees: a short headline, the product above the fold, no sideways
// scroll on a phone, the screenshot that matches the colour scheme, and a
// top nav without the insider tabs.

const SHOTS = process.env.DOCS_SHOTS_DIR;

async function open(page: Page, width: number, height: number, scheme: 'light' | 'dark') {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ colorScheme: scheme });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
}

for (const [label, width, height, maxLines] of [
  ['desktop', 1280, 800, 1],
  ['phone', 390, 844, 3],
] as const) {
  test(`${label}: headline is short and the product shows above the fold`, async ({ page }) => {
    await open(page, width, height, 'light');
    const h1 = page.locator('.pl-title');
    const box = await h1.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const lh = parseFloat(getComputedStyle(el).lineHeight);
      return { lines: Math.round(r.height / lh) };
    });
    expect(box.lines).toBeLessThanOrEqual(maxLines);

    const img = page.locator('.pl-hero-img.pl-only-light');
    await expect(img).toBeVisible();
    const top = await img.evaluate((el) => el.getBoundingClientRect().top);
    expect(top).toBeLessThan(height);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    // The docs layout (sidebar + article) is not drawn on the front page.
    await expect(page.locator('.md-main')).toBeHidden();

    if (SHOTS) await page.screenshot({ path: `${SHOTS}/landing-${label}-light.png`, fullPage: true });
  });
}

test('dark scheme shows the dark screenshot only', async ({ page }) => {
  await open(page, 1280, 800, 'dark');
  await expect(page.locator('.pl-hero-img.pl-only-dark')).toBeVisible();
  await expect(page.locator('.pl-hero-img.pl-only-light')).toBeHidden();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/landing-desktop-dark.png`, fullPage: true });
});

test('top nav has no insider tabs, and the day tabs switch', async ({ page }) => {
  await open(page, 1280, 800, 'light');
  const tabs = page.locator('.md-tabs__link');
  await expect(tabs.first()).toBeVisible();
  const names = await tabs.allInnerTexts();
  expect(names.map((n) => n.trim())).not.toContain('Credits');
  expect(names.map((n) => n.trim())).not.toContain('Repo Traffic');

  const panels = page.locator('.pl-day-panel');
  await expect(panels.nth(0)).toBeVisible();
  await page.locator('label[for="pl-day-3"]').click();
  await expect(panels.nth(2)).toBeVisible();
  await expect(panels.nth(0)).toBeHidden();
});

test('the day tabs show the Simple wall in the morning, after school and in the evening, each image loaded', async ({ page }) => {
  await open(page, 1280, 800, 'light');
  const srcs = await page.locator('.pl-day-panel img').evaluateAll((imgs) => imgs.map((i) => (i as HTMLImageElement).getAttribute('src')!.split('/').pop()));
  expect(srcs).toEqual(['day-morning.png', 'day-afternoon.png', 'day-evening.png']);
  for (const n of [1, 2, 3]) {
    await page.locator(`label[for="pl-day-${n}"]`).click();
    const img = page.locator('.pl-day-panel img').nth(n - 1);
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(1920);
  }
});
