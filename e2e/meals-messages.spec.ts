import { test, expect } from '@playwright/test';
import { getSeededParentId } from './helpers/auth';

/**
 * Meals and Messages in the new look (#882): Meals says what is for dinner
 * tonight first and shows a linked recipe's photo; both pages use quiet rows
 * at least 56px tall, with the message at prose size.
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const PIN = process.env.E2E_PIN || '1234';
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

test.describe('Meals and Messages pages', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database');
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
  });

  test('Meals: Tonight first, the recipe photo on its row, rows at least 56px', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const tag = Date.now();
    const recipe = await (await page.request.post('/api/recipes', {
      data: { name: `Photo recipe ${tag}`, imageUrl: '/logo-prism.png' },
    })).json();
    // The week can start on Sunday or Monday; plan tonight in both so the
    // page finds it whichever the instance uses.
    const now = new Date();
    const sun = new Date(now); sun.setDate(now.getDate() - now.getDay());
    const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const name = `Tonight dinner ${tag}`;
    const meals: string[] = [];
    for (const weekOf of new Set([ymd(sun), ymd(mon)])) {
      const res = await page.request.post('/api/meals', {
        data: { name, weekOf, dayOfWeek: DAYS[now.getDay()], mealType: 'dinner', recipeId: recipe.id },
      });
      expect(res.ok()).toBe(true);
      meals.push((await res.json()).id);
    }
    try {
      await page.goto('/meals');
      await expect(page.locator('[data-meals-tonight]')).toHaveText(`Tonight: ${name}`, { timeout: 60_000 });
      const row = page.locator('[data-meal-row]').filter({ hasText: name }).first();
      await expect(row.locator('[data-meal-photo]')).toBeVisible();
      const heights = await page.locator('[data-meal-row]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
      expect(heights.length).toBeGreaterThan(0);
      for (const h of heights) expect(h).toBeGreaterThanOrEqual(56);
      await expect(page.locator('[data-meals-day-heading]').filter({ hasText: 'Today' })).toHaveCount(1);
    } finally {
      for (const id of meals) await page.request.delete(`/api/meals/${id}`);
      await page.request.delete(`/api/recipes/${recipe.id}`);
    }
  });

  test('Meals on a phone: a long description is one line, not the whole recipe (#1020)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const tag = Date.now();
    const long = Array.from({ length: 30 }, (_, i) => `Step ${i + 1}: stir the pot and season to taste.`).join(' ');
    const now = new Date();
    const sun = new Date(now); sun.setDate(now.getDate() - now.getDay());
    const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const name = `Long recipe dinner ${tag}`;
    const meals: string[] = [];
    for (const weekOf of new Set([ymd(sun), ymd(mon)])) {
      const res = await page.request.post('/api/meals', { data: { name, weekOf, dayOfWeek: DAYS[now.getDay()], mealType: 'dinner', description: long } });
      expect(res.ok()).toBe(true);
      meals.push((await res.json()).id);
    }
    try {
      await page.goto('/meals');
      const desc = page.locator('[data-meal-row]').filter({ hasText: name }).first().locator('[data-meal-description]');
      await expect(desc).toBeVisible({ timeout: 60_000 });
      const m = await desc.evaluate((e) => ({ h: e.getBoundingClientRect().height, line: parseFloat(getComputedStyle(e).lineHeight) }));
      expect(m.h, 'one line').toBeLessThanOrEqual(m.line + 1);
    } finally {
      for (const id of meals) await page.request.delete(`/api/meals/${id}`);
    }
  });

  test('Messages: quiet rows with the sender as meta and the message at prose size', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const text = `A quiet note ${Date.now()}`;
    const msg = await (await page.request.post('/api/messages', { data: { message: text, authorId: getSeededParentId() } })).json();
    try {
      await page.goto('/messages');
      const row = page.locator('[data-message-row]').filter({ hasText: text });
      await expect(row).toBeVisible({ timeout: 60_000 });
      const box = await row.evaluate((e) => {
        const cs = getComputedStyle(e);
        return { h: e.getBoundingClientRect().height, border: cs.borderTopWidth };
      });
      expect(box.h).toBeGreaterThanOrEqual(56);
      expect(box.border, 'a row, not a bordered card').toBe('0px');
      await expect(row.locator('[data-person-mark]')).toHaveCount(1);
      const sizes = await row.evaluate((e) => {
        const px = (sel: string) => parseFloat(getComputedStyle(e.querySelector(sel)!).fontSize);
        return { text: px('[data-message-text]'), sender: px('[data-message-sender]') };
      });
      expect(sizes.text, 'the message reads larger than its meta').toBeGreaterThan(sizes.sender);
      expect(sizes.text).toBeGreaterThanOrEqual(16);
    } finally {
      await page.request.delete(`/api/messages/${msg.id}`);
    }
  });
});
