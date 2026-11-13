import { test, expect } from '@playwright/test';
import { getSeededParentId, getFirstParent, verifySettingsPinViaAPI } from './helpers/auth';

/**
 * The Chores page (#880) opens on what to do: list rows (#932) at least 56px
 * tall, no on or off switch outside Manage, and a tick with Undo. A chore
 * done today leaves the list and cannot be ticked again (#984, #1051); a row
 * shows the person's dot, not a ring to aim for, and its title strikes
 * through on the tap.
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
      const mine = page.locator('[data-chores-section="today"] [data-list-row]').filter({ hasText: title });
      await expect(mine.locator('[data-person-mark="dot"]'), 'the person as a dot').toHaveCount(1);
      await expect(mine.locator('[data-person-mark="ring"]'), 'no ring that reads as a checkbox').toHaveCount(0);

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

      // Done for today (#984, #1051): it leaves the list, not even waiting
      // under Tomorrow or Later, and a second tick is still refused.
      await expect(page.locator('[data-chores-do]').getByText(title, { exact: true }), 'gone once done').toHaveCount(0, { timeout: 15_000 });
      const again = await page.request.post(`/api/chores/${chore.id}/complete`, { data: { completedBy: getSeededParentId() } });
      expect(again.status(), 'a second tick is refused').toBe(409);

      // The tick's Undo takes it back, and the chore returns.
      await undo.click();
      await expect.poll(() => completions(chore.id), { timeout: 15_000 }).toBe(before);
      // Due today again: Undo used to leave it with no due date at all, off
      // the list for good (#1051).
      const back = ((await (await page.request.get('/api/chores')).json()).chores as Array<{ id: string; nextDue: string | null }>).find((c) => c.id === chore.id)!;
      expect(back.nextDue?.slice(0, 10), 'due today again after Undo').toBe(today);
      await expect(mine, 'back on the list after Undo').toBeVisible({ timeout: 15_000 });

      // Manage shows the switches.
      await page.locator('[data-chores-manage]').click();
      await expect(page.getByRole('switch').first()).toBeVisible();
    } finally {
      await page.request.delete(`/api/chores/${chore.id}`);
      await page.request.patch('/api/settings', { data: { key: 'security', value: original } });
    }
  });
  // #1107: a daily chore done twice a day stays on the do list after the
  // first tick, showing how many are done, and leaves after the second.
  test('a chore done twice a day stays until its second tick', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
    const title = `Feed the cat ${Date.now()}`;
    const res = await page.request.post('/api/chores', { data: { title, category: 'pets', frequency: 'daily', timesPerDay: 2, pointValue: 0, requiresApproval: false, nextDue: today } });
    expect(res.status()).toBe(201);
    const chore = await res.json();
    try {
      expect(chore.timesPerDay, 'saved').toBe(2);
      const row = page.locator('[data-chores-section="today"] [data-list-row]').filter({ hasText: title });
      await page.goto('/chores');
      await expect(row).toContainText('0 of 2', { timeout: 60_000 });

      expect((await page.request.post(`/api/chores/${chore.id}/complete`, { data: { completedBy: getSeededParentId() } })).ok()).toBe(true);
      await page.reload();
      await expect(row, 'still due after one tick').toContainText('1 of 2', { timeout: 30_000 });

      expect((await page.request.post(`/api/chores/${chore.id}/complete`, { data: { completedBy: getSeededParentId() } })).ok()).toBe(true);
      const third = await page.request.post(`/api/chores/${chore.id}/complete`, { data: { completedBy: getSeededParentId() } });
      expect(third.status(), 'a third tick is refused: done for today').toBe(409);
      await page.reload();
      await expect(page.locator('[data-chores-do]')).toBeVisible({ timeout: 30_000 });
      await expect(row, 'gone after the second tick').toHaveCount(0);
    } finally {
      await page.request.delete(`/api/chores/${chore.id}`);
    }
  });

  // #1109: a reminder is added with the chore form in its reminder mode, is
  // saved with no points or approval, shows its time and is Late once that
  // has passed; a tick takes it off the list.
  test('a reminder with a passed time is marked Late, and a tick clears it', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
    const settings = (await (await page.request.get('/api/settings')).json()).settings ?? {};
    const original = settings.security ?? {};
    const title = `Allergy tablet ${Date.now()}`;
    let id: string | undefined;
    try {
      await page.request.patch('/api/settings', { data: { key: 'security', value: { ...original, requirePinForEveryChange: false } } });
      await page.goto('/chores');
      await page.locator('[data-chores-add-reminder]').click();
      const form = page.getByRole('dialog', { name: 'Add Reminder' });
      await expect(form).toBeVisible({ timeout: 30_000 });
      await expect(form.getByText('Points'), 'no points on a reminder').toHaveCount(0);
      await expect(form.getByText('Requires approval'), 'no approval on a reminder').toHaveCount(0);
      await form.getByPlaceholder(/Allergy tablet/).fill(title);
      await expect(form.getByRole('button', { name: 'Add Reminder' }), 'a time is required').toBeDisabled();
      // Midnight: already passed, whatever the time of day the test runs.
      await form.locator('[data-chore-time]').fill('00:00');
      await form.getByRole('button', { name: 'Add Reminder' }).click();
      await expect(form).toHaveCount(0);

      const saved = ((await (await page.request.get('/api/chores')).json()).chores as Array<{ id: string; title: string; kind: string; pointValue: number; requiresApproval: boolean }>).find((c) => c.title === title);
      expect(saved, 'saved').toBeTruthy();
      id = saved!.id;
      expect({ kind: saved!.kind, pointValue: saved!.pointValue, requiresApproval: saved!.requiresApproval }).toEqual({ kind: 'reminder', pointValue: 0, requiresApproval: false });

      const row = page.locator('[data-chores-section="today"] [data-list-row]').filter({ hasText: title });
      await expect(row).toContainText('12:00 AM', { timeout: 30_000 });
      await expect(row.locator('[data-chore-late]'), 'marked Late').toHaveText('Late');

      await row.locator('button').first().click();
      const who = page.getByRole('dialog', { name: 'Who did it?' });
      const undo = page.getByRole('button', { name: 'Undo' });
      await expect(who.or(undo).first()).toBeVisible({ timeout: 15_000 });
      if (await who.isVisible()) await who.getByRole('button').first().click();
      await expect(page.locator('[data-chores-do]').getByText(title, { exact: true }), 'gone once ticked').toHaveCount(0, { timeout: 15_000 });
    } finally {
      if (id) await page.request.delete(`/api/chores/${id}`);
      await page.request.patch('/api/settings', { data: { key: 'security', value: original } });
    }
  });

  // #996: a pet is added under Family in Settings, a chore can be for it
  // and shows its name, and removing the pet keeps the chore.
  test('a chore for a pet shows the pet, and outlives it', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
    await verifySettingsPinViaAPI(page, (await getFirstParent(page)).name);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
    const petName = `Biscuit ${Date.now() % 100000}`;
    const title = `Walk the dog ${Date.now()}`;
    let petId: string | undefined, choreId: string | undefined;
    const pets = async () => ((await (await page.request.get('/api/pets')).json()).pets as Array<{ id: string; name: string; kind: string }>);
    try {
      await page.goto('/settings?section=family');
      await page.locator('[data-pets-add]').click({ timeout: 60_000 });
      const form = page.locator('[data-pet-form]');
      await form.getByLabel("Pet's name").fill(petName);
      await form.getByRole('button', { name: 'Dog' }).click();
      await form.getByRole('button', { name: 'Add Pet' }).click();
      await expect(page.locator(`[data-pet-row="${petName}"]`)).toBeVisible({ timeout: 15_000 });
      const pet = (await pets()).find((p) => p.name === petName)!;
      petId = pet.id;
      expect(pet.kind).toBe('dog');

      await page.goto('/chores');
      await page.getByRole('button', { name: 'Add Chore' }).click({ timeout: 60_000 });
      const dialog = page.getByRole('dialog', { name: 'Add Chore' });
      await dialog.getByPlaceholder('Chore title...').fill(title);
      await dialog.locator('input[type="date"]').fill(today);
      await dialog.locator(`[data-chore-for="${petName}"]`).click();
      await dialog.getByRole('button', { name: 'Add Chore' }).click();
      await expect(dialog).toHaveCount(0);

      const row = page.locator('[data-chores-section="today"] [data-list-row]').filter({ hasText: title });
      await expect(row.locator(`[data-chore-pet="${petName}"]`), 'the pet on its chore').toBeVisible({ timeout: 30_000 });
      const listed = async () => ((await (await page.request.get('/api/chores')).json()).chores as Array<{ id: string; title: string; pet: { id: string } | null }>).find((c) => c.title === title);
      choreId = (await listed())!.id;
      expect((await listed())!.pet?.id).toBe(petId);

      // #856: once done it stays, under Pets, done today, saying who did it
      // and when; the API carries today's ticks for it.
      const fam = await (await page.request.get('/api/family')).json();
      const me = ((fam.members ?? fam) as Array<{ id: string; name: string }>).find((m) => m.id === getSeededParentId())!;
      expect((await page.request.post(`/api/chores/${choreId}/complete`, { data: { completedBy: getSeededParentId() } })).ok()).toBe(true);
      const ticks = ((await (await page.request.get('/api/chores')).json()).chores as Array<{ id: string; todayTicks?: Array<{ at: string; by: { name: string } }> }>).find((c) => c.id === choreId)!.todayTicks;
      expect(ticks?.map((k) => k.by.name)).toEqual([me.name]);
      await page.reload();
      const done = page.locator('[data-chores-section="pets-done"] [data-list-row]').filter({ hasText: title });
      await expect(done, 'kept once done, for the pet').toBeVisible({ timeout: 30_000 });
      await expect(done).toContainText(new RegExp(`${me.name} \\d{1,2}:\\d{2} (AM|PM)`));
      await expect(row, 'no longer due').toHaveCount(0);
      await expect(done.locator('button'), 'a done row is not ticked again').toHaveCount(0);

      // Removing the pet keeps the chore, for no one in particular.
      expect((await page.request.delete(`/api/pets/${petId}`)).ok()).toBe(true);
      petId = undefined;
      const after = await listed();
      expect(after, 'the chore stays').toBeTruthy();
      expect(after!.pet).toBeNull();
    } finally {
      if (choreId) await page.request.delete(`/api/chores/${choreId}`);
      if (petId) await page.request.delete(`/api/pets/${petId}`);
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
      await expect(blockA.locator('[data-list-row]').filter({ hasText: forA }), 'no name repeated under its heading').not.toContainText(a.name);
      // Side by side on a wide screen (#1051), not stacked in one column.
      const ra = (await blockA.boundingBox())!, rb = (await blockB.boundingBox())!;
      expect(Math.abs(ra.y - rb.y), 'two people on one top line').toBeLessThanOrEqual(2);
      expect(Math.abs(ra.x - rb.x), 'in different columns').toBeGreaterThan(200);

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
