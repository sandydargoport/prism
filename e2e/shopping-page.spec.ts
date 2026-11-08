import { test, expect } from '@playwright/test';
import { getSeededParentId } from './helpers/auth';

/**
 * The Shopping page (#881): one calm list; a tap crosses an item off and it
 * folds into "Checked off"; a pencil at the row's end edits it (#1053).
 * Headings in the display face with a muted colour mark (#986).
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const PIN = process.env.E2E_PIN || '1234';

test.describe('the Shopping page', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database');
  test.setTimeout(90_000);
  // Both tests use the first list; in parallel one page's refresh lands on the other's.
  test.describe.configure({ mode: 'serial' });

  test('a calm list: a tap crosses an item off and back, the pencil edits and deletes', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
    const lists = await (await page.request.get('/api/shopping-lists')).json();
    const list = (lists.lists ?? lists)[0];
    const name = `Calm item ${Date.now()}`;
    const item = await (await page.request.post('/api/shopping-items', { data: { listId: list.id, name, category: 'produce' } })).json();
    try {
      await page.goto('/shopping');
      const calm = page.locator('[data-shopping-calm]');
      await expect(calm).toBeVisible({ timeout: 60_000 });
      // The list on screen is the one marked chosen, even on a first load.
      await expect(page.locator('[data-shopping-list-pill][aria-pressed="true"]')).toHaveText(new RegExp(`^${list.name}`));
      const heights = await calm.locator('[data-list-row]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
      for (const h of heights) expect(h).toBeGreaterThanOrEqual(56);

      // Headings (#986): the display face, not capitals, a muted colour mark.
      const heading = calm.locator('[data-shopping-category="produce"] h2');
      const look = await heading.evaluate((h) => {
        const probe = document.createElement('span');
        probe.style.fontFamily = 'var(--font-display)';
        document.body.appendChild(probe);
        const display = getComputedStyle(probe).fontFamily;
        probe.remove();
        const cs = getComputedStyle(h);
        const [r, g, b] = getComputedStyle(h.querySelector('[data-shopping-category-mark]')!).backgroundColor.match(/\d+/g)!.map(Number).map((v) => v / 255);
        const max = Math.max(r!, g!, b!), min = Math.min(r!, g!, b!), l = (max + min) / 2;
        const sat = max === min ? 0 : (max - min) / (l > 0.5 ? 2 - max - min : max + min);
        return { font: cs.fontFamily, display, transform: cs.textTransform, sat };
      });
      expect(look.font, 'heading in the display face').toBe(look.display);
      expect(look.transform, 'no capitals').toBe('none');
      expect(look.sat, 'a muted mark').toBeLessThanOrEqual(0.4);

      // An item with no category sits under "Other", not the id "other" (#1064).
      const loose = await (await page.request.post('/api/shopping-items', { data: { listId: list.id, name: `Loose ${Date.now()}`, category: 'other' } })).json();
      try {
        await page.reload();
        await expect(calm.locator('[data-shopping-category="other"] h2')).toHaveText('Other', { timeout: 30_000 });
      } finally {
        await page.request.delete(`/api/shopping-items/${loose.id}`);
      }

      // #1053: no ring to aim for; a tap anywhere crosses the item off, its
      // name struck through, then it moves to Checked off; a tap there puts it back.
      await expect(calm.locator('[data-shopping-ring]'), 'no ring').toHaveCount(0);
      const row = calm.locator('[data-shopping-category] [data-list-row]').filter({ hasText: name });
      await row.locator('> button').first().click();
      await expect(row.locator('[data-shopping-struck]'), 'struck through on the tap').toBeVisible();
      await expect(calm.locator('[data-shopping-cart-toggle]')).toHaveText(/^Checked off \(\d+\)$/);
      await calm.locator('[data-shopping-cart-toggle]').click();
      const inCart = calm.locator('[data-shopping-cart] [data-list-row]').filter({ hasText: name });
      await expect(inCart).toBeVisible();
      await inCart.locator('> button').first().click();
      await expect(row, 'back on the list').toBeVisible();

      // The pencil at the end of the row edits it, and Delete is in there.
      const pencil = row.locator('[data-shopping-edit]');
      const pb = (await pencil.boundingBox())!;
      expect(pb.width).toBeGreaterThanOrEqual(44);
      expect(pb.height).toBeGreaterThanOrEqual(44);
      await pencil.click();
      await page.locator('[data-shopping-item-delete]').click();
      await expect(row, 'deleted from the edit form').toHaveCount(0, { timeout: 15_000 });
    } finally {
      await page.request.delete(`/api/shopping-items/${item.id}`);
    }
  });

  // #1070: on a phone (and the wall), adding asks for the category in the
  // field's own place; a tap files it, Skip leaves it in Other, and the field
  // comes back for the next item. A list that shows a few categories offers
  // those first, then every other one; moving to another list closes it.
  test('adding an item asks where it goes, in the field\'s place', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
    const lists = await (await page.request.get('/api/shopping-lists')).json();
    const list = (lists.lists ?? lists)[0];
    const filed = `Filed ${Date.now()}`;
    const skipped = `Skipped ${Date.now()}`;
    const left = `Left ${Date.now()}`;
    const before = list.visibleCategories ?? null;
    const itemsNamed = async (n: string) => {
      const all = await (await page.request.get('/api/shopping-lists?includeItems=true')).json();
      const mine = ((all.lists ?? all) as Array<{ id: string; items: Array<{ id: string; name: string; category: string }> }>).find((l) => l.id === list.id)!;
      return mine.items.filter((i) => i.name === n);
    };
    try {
      // A list that shows only produce.
      expect((await page.request.patch(`/api/shopping-lists/${list.id}`, { data: { visibleCategories: ['produce'] } })).ok()).toBe(true);
      await page.goto('/shopping');
      const calm = page.locator('[data-shopping-calm]');
      const field = calm.locator('[data-shopping-add]');
      await expect(field).toBeVisible({ timeout: 60_000 });
      const fieldTop = (await field.boundingBox())!.y;

      await field.fill(filed);
      await field.press('Enter');
      const ask = calm.locator('[data-shopping-file]');
      await expect(ask).toBeVisible({ timeout: 15_000 });
      await expect(ask).toContainText(filed);
      expect(Math.abs((await ask.boundingBox())!.y - fieldTop), 'asked where the field was').toBeLessThanOrEqual(4);
      // #1076: every category at once, this list's own first.
      await expect(ask.locator('[data-shopping-file-choice]').first(), "this list's category first").toHaveAttribute('data-shopping-file-choice', 'produce');
      expect(await ask.locator('[data-shopping-file-choice]').count(), 'every category offered').toBeGreaterThan(5);
      const dairy = ask.locator('[data-shopping-file-choice="dairy"]');
      await expect(dairy, 'no More to open first').toBeVisible();
      const db = (await dairy.boundingBox())!;
      expect(db.height, 'a finger-sized choice').toBeGreaterThanOrEqual(44);
      await dairy.click();
      await expect(field, 'the field is back').toBeFocused();
      await expect(calm.locator('[data-shopping-category="dairy"] [data-list-row]').filter({ hasText: filed })).toBeVisible({ timeout: 15_000 });
      expect((await itemsNamed(filed)).map((i) => i.category)).toEqual(['dairy']);

      await field.fill(skipped);
      await field.press('Enter');
      await ask.locator('[data-shopping-file-skip]').click();
      await expect(field).toBeVisible();
      await expect(calm.locator('[data-shopping-category="other"] [data-list-row]').filter({ hasText: skipped })).toBeVisible({ timeout: 15_000 });
      expect((await itemsNamed(skipped)).map((i) => i.category)).toEqual(['other']);

      // Moving to another list closes the question; the item stays, in Other.
      await field.fill(left);
      await field.press('Enter');
      await expect(ask).toBeVisible({ timeout: 15_000 });
      const listName = page.getByRole('button', { name: 'Next list' }).locator('xpath=..');
      await expect(listName).toContainText(list.name);
      await page.getByRole('button', { name: 'Next list' }).click();
      await expect(listName, 'the arrow moves to the next list').not.toContainText(list.name);
      await expect(ask, 'not carried to the next list').toHaveCount(0);
      await expect(field).toBeVisible();
      expect((await itemsNamed(left)).map((i) => i.category)).toEqual(['other']);
    } finally {
      await page.request.patch(`/api/shopping-lists/${list.id}`, { data: { visibleCategories: before } });
      for (const n of [filed, skipped, left]) for (const i of await itemsNamed(n)) await page.request.delete(`/api/shopping-items/${i.id}`);
    }
  });

  // #1055: Manage is the categories in quiet rows, not cards with ruled lines.
  // A row's switch shows or hides it on this list, and its name changes in place.
  test('Manage lists the categories as rows: show on this list, rename', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
    const lists = await (await page.request.get('/api/shopping-lists')).json();
    const list = (lists.lists ?? lists)[0];
    const before = list.visibleCategories ?? null;
    const savedCats = (await (await page.request.get('/api/settings')).json()).settings?.shoppingCategories ?? null;
    try {
      expect((await page.request.patch(`/api/shopping-lists/${list.id}`, { data: { visibleCategories: null } })).ok()).toBe(true);
      await page.goto('/shopping');
      await page.locator('[data-shopping-manage]').click();
      const row = page.locator('[data-shopping-manage-row="produce"]');
      await expect(row).toBeVisible({ timeout: 30_000 });
      // Quiet rows: no ruled lines to type on, no blank-line buttons, no cards.
      await expect(page.getByRole('button', { name: '+5' })).toHaveCount(0);
      await expect(page.locator('[data-shopping-manage-view] input:not([data-shopping-new-category])')).toHaveCount(0);
      const rowBox = await row.boundingBox();
      expect(rowBox!.height, 'a row, not a card').toBeLessThan(90);

      // Hide Produce on this list.
      await row.getByRole('switch').click();
      await expect(row.getByRole('switch')).toHaveAttribute('data-shopping-shown', 'off', { timeout: 15_000 });
      const hidden = (await (await page.request.get(`/api/shopping-lists/${list.id}`)).json());
      const visible: string[] = (hidden.list ?? hidden).visibleCategories;
      expect(visible, 'the list no longer shows produce').not.toContain('produce');
      expect(visible.length, 'and still shows the rest').toBeGreaterThan(3);

      // Rename it in place.
      await row.getByRole('button', { name: /^Rename/ }).click();
      await row.locator('[data-shopping-rename-input]').fill('Fruit and veg');
      await row.locator('[data-shopping-rename-input]').press('Enter');
      await expect(row.getByRole('button', { name: 'Rename Fruit and veg' })).toBeVisible({ timeout: 15_000 });
      const cats = (await (await page.request.get('/api/settings')).json()).settings?.shoppingCategories as Array<{ id: string; name: string }>;
      expect(cats.find((c) => c.id === 'produce')?.name).toBe('Fruit and veg');
    } finally {
      await page.request.patch(`/api/shopping-lists/${list.id}`, { data: { visibleCategories: before } });
      if (savedCats) await page.request.patch('/api/settings', { data: { key: 'shoppingCategories', value: savedCats } });
      else {
        const now = (await (await page.request.get('/api/settings')).json()).settings?.shoppingCategories ?? [];
        await page.request.patch('/api/settings', { data: { key: 'shoppingCategories', value: (now as Array<{ id: string; name: string }>).map((c) => c.id === 'produce' ? { ...c, name: 'Produce' } : c) } });
      }
    }
  });

  // #1053: a category is added where the categories are, under Manage, and a
  // list that shows chosen categories gets it too, so it shows at once.
  test('Manage adds a category to this list', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
    const lists = await (await page.request.get('/api/shopping-lists')).json();
    const list = (lists.lists ?? lists)[0];
    const before = list.visibleCategories ?? null;
    const catName = `Garden ${Date.now()}`;
    const catId = catName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    try {
      // A list that shows only produce.
      expect((await page.request.patch(`/api/shopping-lists/${list.id}`, { data: { visibleCategories: ['produce'] } })).ok()).toBe(true);
      await page.goto('/shopping');
      await page.locator('[data-shopping-manage]').click();
      await page.locator('[data-shopping-new-category]').fill(catName);
      await page.locator('[data-shopping-add-category]').click();
      await expect(page.getByText(`Added ${catName} to ${list.name}.`).first()).toBeVisible({ timeout: 15_000 });
      const after = await (await page.request.get(`/api/shopping-lists/${list.id}`)).json();
      expect((after.list ?? after).visibleCategories, 'the list shows the new category').toContain(catId);
      await expect(page.locator(`[data-shopping-manage-row="${catId}"]`), 'its row is in Manage').toBeVisible({ timeout: 15_000 });
    } finally {
      await page.request.patch(`/api/shopping-lists/${list.id}`, { data: { visibleCategories: before } });
      // Take the added category out again, whatever was saved before.
      const now = (await (await page.request.get('/api/settings')).json()).settings?.shoppingCategories ?? [];
      await page.request.patch('/api/settings', { data: { key: 'shoppingCategories', value: (now as Array<{ id: string }>).filter((c) => c.id !== catId && !c.id.startsWith('garden-1')) } });
    }
  });
});
