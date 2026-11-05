import { test, expect, type APIRequestContext } from '@playwright/test';
import { getSeededParentId } from './helpers/auth';

/**
 * "Require the PIN for every change" (#835), measured on the real API: a
 * signed-out wall (a request with no session) may tick and add only once a
 * parent turns the setting off, and never anything else.
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const PIN = process.env.E2E_PIN || '1234';

/**
 * Each test stands in for its own screen, so the per-screen limit one test
 * spends on purpose (and a retry's) never reaches another.
 */
const screen = () => ({ 'x-forwarded-for': `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` });

test.describe('everyday jobs without a PIN', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database');
  test.setTimeout(120_000);

  // The wall itself: with the PIN off, a tick needs no PIN and offers Undo.
  test('a signed-out wall ticks a chore with one tap and can undo it', async ({ page, browser }) => {
    const parentId = getSeededParentId();
    expect((await page.request.post('/api/auth/login', { data: { userId: parentId, pin: PIN } })).ok()).toBe(true);
    const parent = page.request;
    const settingsRes = await (await parent.get('/api/settings')).json();
    const original = settingsRes?.security ?? settingsRes?.settings?.security ?? {};
    const layout = await (await parent.post('/api/layouts', { data: { name: `Wall tick e2e ${Date.now()}`, widgets: [{ i: 'chores', x: 0, y: 0, w: 48, h: 27 }] } })).json();
    const wallContext = await browser.newContext({ viewport: { width: 1920, height: 1080 }, extraHTTPHeaders: screen() });
    const completions = async (choreId: string) => {
      const res = await (await parent.get('/api/chores/completions?days=2&limit=100')).json();
      return ((res.completions ?? res) as Array<{ choreId: string }>).filter((c) => c.choreId === choreId).length;
    };
    try {
      await parent.patch('/api/settings', { data: { key: 'security', value: { ...original, requirePinForEveryChange: false } } });
      const wall = await wallContext.newPage();
      await wall.goto(`/d/${layout.slug}`);
      const tick = wall.locator('[aria-label^="Complete "]').first();
      await tick.waitFor({ timeout: 60_000 });
      const title = (await tick.getAttribute('aria-label'))!.replace(/^Complete /, '');
      const chores = await (await parent.get('/api/chores')).json();
      const chore = (chores.chores ?? chores).find((c: { title: string }) => c.title === title);
      const before = await completions(chore.id);

      await tick.click();
      // A chore nobody is assigned to asks who did it, with no PIN.
      const who = wall.locator('[data-who-did-it]');
      if (await who.isVisible({ timeout: 1500 }).catch(() => false)) await who.locator('button').first().click();
      // No PIN pad: the tick lands, and the toast offers Undo.
      const undo = wall.getByRole('button', { name: 'Undo' });
      await expect(undo).toBeVisible();
      await expect(wall.getByText(/Enter (your )?PIN/i)).toHaveCount(0);
      await expect.poll(() => completions(chore.id)).toBe(before + 1);

      await undo.click();
      await expect.poll(() => completions(chore.id), { timeout: 15_000 }).toBe(before);
    } finally {
      await parent.patch('/api/settings', { data: { key: 'security', value: original } });
      await parent.delete(`/api/layouts/${layout.id}`);
      await wallContext.close();
    }
  });

  // Last: it spends this screen's 30-a-minute allowance on purpose.
  test('the wall can tick and add only with the setting off, and nothing more', async ({ page, playwright }, info) => {
    const parentId = getSeededParentId();
    const login = await page.request.post('/api/auth/login', { data: { userId: parentId, pin: PIN } });
    expect(login.ok(), 'precondition: login must succeed').toBe(true);
    const parent = page.request;
    const wall: APIRequestContext = await playwright.request.newContext({ baseURL: info.project.use.baseURL, extraHTTPHeaders: screen() });

    const settingsRes = await (await parent.get('/api/settings')).json();
    const original = settingsRes?.security ?? settingsRes?.settings?.security ?? {};
    const setPin = (on: boolean) => parent.patch('/api/settings', { data: { key: 'security', value: { ...original, requirePinForEveryChange: on } } });

    const task = await (await parent.post('/api/tasks', { data: { title: `Wall task ${Date.now()}` } })).json();
    const chore = await (await parent.post('/api/chores', {
      data: { title: `Wall chore ${Date.now()}`, category: 'other', frequency: 'daily', requiresApproval: true, pointValue: 5, createdBy: parentId },
    })).json();
    const lists = await (await parent.get('/api/shopping-lists')).json();
    const list = (lists.lists ?? lists)[0];
    const item = await (await parent.post('/api/shopping-items', { data: { listId: list.id, name: `Wall milk ${Date.now()}` } })).json();
    const added: string[] = [];

    try {
      // On (an existing install): the wall gets nothing.
      expect((await setPin(true)).ok()).toBe(true);
      expect((await wall.patch(`/api/tasks/${task.id}`, { data: { completed: true } })).status()).toBe(401);
      expect((await wall.post(`/api/chores/${chore.id}/complete`, { data: { completedBy: parentId } })).status()).toBe(401);

      // Off: the everyday jobs work.
      expect((await setPin(false)).ok()).toBe(true);
      expect((await wall.patch(`/api/tasks/${task.id}`, { data: { completed: true } })).status()).toBe(200);
      expect((await wall.patch(`/api/shopping-items/${item.id}`, { data: { checked: true } })).status()).toBe(200);
      const add = await wall.post('/api/shopping-items', { data: { listId: list.id, name: `Wall eggs ${Date.now()}` } });
      expect(add.status()).toBe(201);
      added.push((await add.json()).id);

      // A tick by the wall never approves: the chore waits for a parent.
      const done = await wall.post(`/api/chores/${chore.id}/complete`, { data: { completedByIndex: 0 } });
      expect(done.status()).toBe(201);
      const completion = await done.json();
      expect(completion.approvedBy ?? null, 'pending, not approved').toBeNull();
      // Its Undo works, right after.
      expect((await wall.delete(`/api/chores/${chore.id}/complete`)).status()).toBe(200);

      // Everything else still needs a parent.
      expect((await wall.patch(`/api/tasks/${task.id}`, { data: { title: 'renamed' } })).status()).toBe(401);
      expect((await wall.delete(`/api/tasks/${task.id}`)).status()).toBe(401);
      expect((await wall.patch(`/api/shopping-items/${item.id}`, { data: { name: 'renamed' } })).status()).toBe(401);
      expect((await wall.post(`/api/chores/${chore.id}/approve`, { data: {} })).status()).toBe(401);
      expect((await wall.patch('/api/settings', { data: { key: 'security', value: { requirePinForEveryChange: true } } })).status()).toBe(401);

      // At most 30 changes a minute from one screen.
      const statuses: number[] = [];
      for (let i = 0; i < 31; i++) statuses.push((await wall.patch(`/api/tasks/${task.id}`, { data: { completed: i % 2 === 0 } })).status());
      expect(statuses, 'the limit answers 429').toContain(429);
    } finally {
      await parent.patch('/api/settings', { data: { key: 'security', value: original } });
      await parent.delete(`/api/tasks/${task.id}`);
      await parent.delete(`/api/chores/${chore.id}`);
      await parent.delete(`/api/shopping-items/${item.id}`);
      for (const id of added) await parent.delete(`/api/shopping-items/${id}`);
      await wall.dispose();
    }
  });
});
