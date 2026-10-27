/**
 * Display registry (#690): a screen is named from itself, and every other
 * device sees it, can rename it, and can remove it.
 *
 * Two browser contexts stand in for the wall screen and a parent's phone, so
 * the cookies are really separate: only the wall carries the display cookie.
 * Runs against a fresh-seeded database only (it adds and removes a row).
 */
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { getFirstParent, verifySettingsPinViaAPI } from './helpers/auth';

const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';

async function openDisplays(context: BrowserContext, parentName: string): Promise<Page> {
  const page = await context.newPage();
  await verifySettingsPinViaAPI(page, parentName);
  await page.goto('/settings?section=displays');
  await expect(page.getByRole('heading', { name: 'Displays', level: 2 })).toBeVisible();
  return page;
}

test.describe('Display registry', () => {
  test('name a screen on itself, then rename and remove it from another device', async ({ browser }) => {
    test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a fresh-seeded DB');
    // The first visit compiles Settings and the display routes on the dev server.
    test.setTimeout(120_000);
    // Names unique to this attempt, so a retry is not confused by rows an
    // earlier attempt left behind.
    const tag = Date.now().toString(36);
    const KITCHEN = `Kitchen ${tag}`;
    const RENAMED = `Kitchen wall ${tag}`;

    const probe = await browser.newPage();
    const parent = await getFirstParent(probe);
    await probe.close();

    const wallContext = await browser.newContext();
    const phoneContext = await browser.newContext();
    try {
      // On the wall: name it.
      const wall = await openDisplays(wallContext, parent.name);
      await expect(wall.getByLabel('Name for this screen')).toBeVisible({ timeout: 60_000 });
      await wall.getByLabel('Name for this screen').fill(KITCHEN);
      await wall.getByRole('button', { name: 'Name this display' }).click();
      await expect(wall.getByText('This screen is named')).toContainText(KITCHEN);
      const wallRow = wall.getByTestId('display-row').filter({ hasText: KITCHEN });
      await expect(wallRow).toContainText('This screen');
      await expect(wallRow).toContainText('Online');

      // On the phone: listed, online, and not "this screen".
      const phone = await openDisplays(phoneContext, parent.name);
      const phoneRow = phone.getByTestId('display-row').filter({ hasText: KITCHEN });
      await expect(phoneRow).toContainText('Online');
      await expect(phoneRow).not.toContainText('This screen');
      await expect(phone.getByLabel('Name for this screen')).toBeVisible();

      // Rename from the phone; the wall shows it after a refresh.
      await phoneRow.getByRole('button', { name: 'Rename' }).click();
      await phone.getByLabel(`New name for ${KITCHEN}`).fill(RENAMED);
      await phone.getByRole('button', { name: 'Save' }).click();
      await expect(phone.getByTestId('display-row').filter({ hasText: RENAMED })).toBeVisible();
      await wall.reload();
      await expect(wall.getByText('This screen is named')).toContainText(RENAMED);

      // Remove from the phone; the wall's next heartbeat forgets its name.
      phone.once('dialog', (d) => d.accept());
      await phone.getByTestId('display-row').filter({ hasText: RENAMED })
        .getByRole('button', { name: 'Remove' }).click();
      await expect(phone.getByTestId('display-row').filter({ hasText: RENAMED })).toHaveCount(0);

      const beat = await wall.request.post('/api/displays/heartbeat');
      expect((await beat.json()).display).toBeNull();
      const cookies = await wallContext.cookies();
      expect(cookies.find((c) => c.name === 'prism_display')).toBeUndefined();
      await wall.reload();
      await expect(wall.getByLabel('Name for this screen')).toBeVisible();
    } finally {
      await wallContext.close();
      await phoneContext.close();
    }
  });
});

/** A stored value, or null while the page is in the middle of reloading itself. */
async function readStorage(page: Page, key: string): Promise<string | null> {
  try {
    return await page.evaluate((k) => localStorage.getItem(k), key);
  } catch {
    return null;
  }
}

test.describe('Display settings follow the screen', () => {
  test('edited from a phone, changed on the screen, and back after a browser reset', async ({ browser }) => {
    test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a fresh-seeded DB');
    test.setTimeout(180_000);
    const tag = Date.now().toString(36);
    const HALL = `Hall ${tag}`;
    const TIMEOUT = 'prism-screensaver-timeout';

    const probe = await browser.newPage();
    const parent = await getFirstParent(probe);
    await probe.close();

    const wallContext = await browser.newContext();
    const phoneContext = await browser.newContext();
    const resetContext = await browser.newContext();
    try {
      const phone = await openDisplays(phoneContext, parent.name);
      const stored = async () => {
        const { displays } = await (await phone.request.get('/api/displays')).json();
        return displays.find((d: { name: string }) => d.name === HALL);
      };

      // The wall already has a setting of its own when it is named; naming copies it up.
      const wall = await openDisplays(wallContext, parent.name);
      await wall.evaluate((k) => localStorage.setItem(k, '300'), TIMEOUT);
      await wall.getByLabel('Name for this screen').fill(HALL);
      await wall.getByRole('button', { name: 'Name this display' }).click();
      await expect.poll(async () => (await stored())?.settings?.[TIMEOUT], { timeout: 15_000 }).toBe('300');

      // Edited from the phone: the wall has it after a refresh.
      const hall = await stored();
      const patch = await phone.request.patch(`/api/displays/${hall.id}`, { data: { settings: { [TIMEOUT]: '600' } } });
      expect(patch.ok()).toBe(true);
      await wall.reload();
      await expect.poll(() => readStorage(wall, TIMEOUT), { timeout: 30_000 }).toBe('600');

      // Changed on the wall: stored within a few seconds, without a refresh.
      await wall.waitForLoadState('load');
      await wall.evaluate(() => localStorage.setItem('prism-screensaver-drift', 'off'));
      await expect.poll(async () => (await stored())?.settings?.['prism-screensaver-drift'], { timeout: 30_000 }).toBe('off');

      // The phone picks the wall's dashboard; the wall's home page opens on it.
      const created = await phone.request.post('/api/layouts', {
        data: { name: `Hall board ${tag}`, widgets: [{ i: 'clock', x: 0, y: 0, w: 16, h: 12 }] },
      });
      const board = await created.json();
      await phone.reload();
      await phone.getByLabel(`Dashboard for ${HALL}`).selectOption({ label: `Hall board ${tag}` });
      await expect.poll(async () => (await stored())?.dashboardId).toBe(board.id);
      await wall.goto('/');
      await expect(wall).toHaveURL(new RegExp(`/d/${board.slug}$`));

      // A reset browser on the same wall takes the screen back, settings and all.
      const fresh = await openDisplays(resetContext, parent.name);
      await fresh.getByLabel('Existing screen').selectOption({ label: HALL });
      await fresh.getByRole('button', { name: 'Use its name and settings' }).click();
      await expect.poll(() => readStorage(fresh, TIMEOUT), { timeout: 30_000 }).toBe('600');
      await expect(fresh.getByText('This screen is named')).toContainText(HALL, { timeout: 30_000 });

      await phone.request.delete(`/api/displays/${hall.id}`);
      await phone.request.delete(`/api/layouts/${board.id}`);
    } finally {
      await wallContext.close();
      await phoneContext.close();
      await resetContext.close();
    }
  });
});

test.describe('Another screen\'s settings', () => {
  test('changed from a phone in Settings > Displays, and the screen uses them', async ({ browser }) => {
    test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a fresh-seeded DB');
    test.setTimeout(180_000);
    const tag = Date.now().toString(36);
    const DEN = `Den ${tag}`;

    const probe = await browser.newPage();
    const parent = await getFirstParent(probe);
    await probe.close();

    const wallContext = await browser.newContext();
    const phoneContext = await browser.newContext();
    try {
      const wall = await openDisplays(wallContext, parent.name);
      await wall.getByLabel('Name for this screen').fill(DEN);
      await wall.getByRole('button', { name: 'Name this display' }).click();
      await expect(wall.getByText('This screen is named')).toContainText(DEN);
      // A screen's own settings are on its own pages, not in its row.
      await expect(wall.getByTestId('display-row').filter({ hasText: DEN })
        .getByRole('button', { name: 'Settings' })).toHaveCount(0);

      const phone = await openDisplays(phoneContext, parent.name);
      await phone.getByTestId('display-row').filter({ hasText: DEN })
        .getByRole('button', { name: 'Settings' }).click();
      const panel = phone.getByTestId('screen-settings');
      await panel.getByLabel(`Activate after on ${DEN}`).selectOption({ label: '1 hour' });
      await expect(panel).toContainText(`Saved. ${DEN} changes within a minute.`);
      // Only shown once there is an effect to time.
      await expect(panel.getByLabel(`Change every on ${DEN}`)).toHaveCount(0);
      await panel.getByLabel(`Widget transition effect on ${DEN}`).selectOption({ label: 'Smoke' });
      await expect(panel.getByLabel(`Change every on ${DEN}`)).toBeVisible();
      await panel.getByLabel(`Drift on ${DEN}`).selectOption({ label: 'Off' });
      await panel.getByLabel(`On-screen keyboard on ${DEN}`).selectOption({ label: 'Never' });
      await expect(panel.getByLabel(`On-screen keyboard on ${DEN}`)).toHaveValue('"never"');

      // On the screen: stored as its own controls store them, and shown there.
      await wall.reload();
      await expect.poll(() => readStorage(wall, 'prism-screensaver-timeout'), { timeout: 30_000 }).toBe('3600');
      expect(await readStorage(wall, 'prism-screensaver-motion')).toBe('smoke');
      expect(await readStorage(wall, 'prism-screensaver-motion-v2')).toBe('1');
      expect(await readStorage(wall, 'prism-screensaver-drift')).toBe('off');
      expect(await readStorage(wall, 'prism:keyboard-on-this-device')).toBe('"never"');
      await wall.goto('/settings?section=display');
      const screensaver = wall.locator('#screensaver-settings');
      await expect(screensaver.locator('select').first()).toHaveValue('3600', { timeout: 30_000 });
      await expect(screensaver.getByRole('checkbox', { name: 'Drift' })).not.toBeChecked();

      const { displays } = await (await phone.request.get('/api/displays')).json();
      const den = displays.find((d: { name: string }) => d.name === DEN);
      await phone.request.delete(`/api/displays/${den.id}`);
    } finally {
      await wallContext.close();
      await phoneContext.close();
    }
  });
});
