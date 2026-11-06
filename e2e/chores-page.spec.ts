import { test, expect } from '@playwright/test';
import { getSeededParentId } from './helpers/auth';

/**
 * The Chores page (#880) opens on what to do: list rows (#932) at least 56px
 * tall, no on or off switch outside Manage, and a tick with Undo. A chore
 * done today shows ticked and cannot be ticked again (#984).
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const PIN = process.env.E2E_PIN || '1234';

test.describe('the Chores page', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database');
  test.setTimeout(90_000);

  test('a do list first, switches behind Manage, and a tick that can be undone', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
    const settings = (await (await page.request.get('/api/settings')).json()).settings ?? {};
    const original = settings.security ?? {};
    const completions = async (choreId: string) => {
      const res = await (await page.request.get('/api/chores/completions?days=2&limit=100')).json();
      return ((res.completions ?? res) as Array<{ choreId: string }>).filter((c) => c.choreId === choreId).length;
    };
    // Its own chore, due today, so the test never depends on what earlier runs left ticked.
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
    const title = `Water the ferns ${Date.now()}`;
    const created = await page.request.post('/api/chores', {
      data: { title, category: 'cleaning', frequency: 'daily', pointValue: 3, requiresApproval: false, nextDue: today },
    });
    expect(created.status()).toBe(201);
    const chore = await created.json();
    try {
      await page.request.patch('/api/settings', { data: { key: 'security', value: { ...original, requirePinForEveryChange: false } } });
      await page.goto('/chores');
      const rows = page.locator('[data-chores-do] [data-list-row]');
      await expect(rows.first()).toBeVisible({ timeout: 60_000 });
      const heights = await rows.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
      for (const h of heights) expect(h, 'row height').toBeGreaterThanOrEqual(56);
      await expect(page.getByRole('switch'), 'no on or off switch outside Manage').toHaveCount(0);

      // Tick it; Undo takes it back.
      const before = await completions(chore.id);
      await page.locator('[data-chores-section="today"] [data-list-row]').filter({ hasText: title }).locator('button').first().click();
      // The who-did-it picker may open first; wait for it or the Undo, whichever comes.
      const who = page.getByRole('dialog', { name: 'Who did it?' });
      const undo = page.getByRole('button', { name: 'Undo' });
      await expect(who.or(undo).first()).toBeVisible({ timeout: 15_000 });
      if (await who.isVisible()) await who.getByRole('button').first().click();
      await expect(undo).toBeVisible();
      await expect.poll(() => completions(chore.id)).toBe(before + 1);

      // Done for today (#984): it stays under Due today, ticked, and a second
      // tick neither adds a completion nor counts points again.
      const doneRow = page.locator('[data-chores-section="today"] [data-list-row]')
        .filter({ has: page.locator('[data-chore-done-mark]') }).filter({ hasText: title });
      await expect(doneRow).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('[data-chores-section="tomorrow"], [data-chores-section="later"]').getByText(title, { exact: true })).toHaveCount(0);
      const again = await page.request.post(`/api/chores/${chore.id}/complete`, { data: { completedBy: getSeededParentId() } });
      expect(again.status(), 'a second tick is refused').toBe(409);
      await doneRow.locator('button').first().click();
      await expect(page.getByText(`${title} is done for today.`).first()).toBeVisible();
      expect(await completions(chore.id)).toBe(before + 1);

      // Its Undo takes the tick back.
      await page.getByRole('listitem').filter({ hasText: 'is done for today.' }).getByRole('button', { name: 'Undo' }).click();
      await expect.poll(() => completions(chore.id), { timeout: 15_000 }).toBe(before);

      // Manage shows the switches.
      await page.locator('[data-chores-manage]').click();
      await expect(page.getByRole('switch').first()).toBeVisible();
    } finally {
      await page.request.delete(`/api/chores/${chore.id}`);
      await page.request.patch('/api/settings', { data: { key: 'security', value: original } });
    }
  });
  test('the do list follows Group by under Manage (#985)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
    const fam = await (await page.request.get('/api/family')).json();
    const [a, b] = ((fam.members ?? fam) as Array<{ id: string; name: string }>).filter((m) => m.id);
    if (!a || !b) throw new Error('needs two seeded members');
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
    const stamp = Date.now();
    const made: string[] = [];
    const make = async (title: string, who: string) => {
      const res = await page.request.post('/api/chores', { data: { title, category: 'cleaning', frequency: 'weekly', pointValue: 1, requiresApproval: false, nextDue: today, assignedTo: who } });
      expect(res.status()).toBe(201);
      made.push((await res.json()).id);
    };
    const forA = `Fold towels ${stamp}`, forB = `Sweep porch ${stamp}`;
    try {
      await make(forA, a.id);
      await make(forB, b.id);
      await page.goto('/chores');
      await expect(page.locator('[data-chores-do]')).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('[data-chores-person]'), 'one list by default').toHaveCount(0);

      // Group by Person under Manage, then back to the do list.
      await page.locator('[data-chores-manage]').click();
      await page.getByRole('button', { name: /^Group/ }).click();
      await page.getByRole('menuitemcheckbox', { name: 'Person' }).click();
      await page.locator('[data-chores-manage]').click();

      const blockA = page.locator(`[data-chores-person="${a.id}"]`);
      const blockB = page.locator(`[data-chores-person="${b.id}"]`);
      await expect(blockA.getByRole('heading', { name: a.name })).toBeVisible();
      await expect(blockA.locator('[data-chores-section="today"]').getByText(forA)).toBeVisible();
      await expect(blockA.getByText(forB)).toHaveCount(0);
      await expect(blockB.locator('[data-chores-section="today"]').getByText(forB)).toBeVisible();
      await expect(blockB.getByText(forA)).toHaveCount(0);

      // None: the single list again.
      await page.locator('[data-chores-manage]').click();
      await page.getByRole('button', { name: /^Group/ }).click();
      await page.getByRole('menuitemcheckbox', { name: 'None' }).click();
      await page.locator('[data-chores-manage]').click();
      await expect(page.locator('[data-chores-person]')).toHaveCount(0);
      await expect(page.locator('[data-chores-section="today"]').getByText(forA)).toBeVisible();
    } finally {
      for (const id of made) await page.request.delete(`/api/chores/${id}`);
    }
  });
});
