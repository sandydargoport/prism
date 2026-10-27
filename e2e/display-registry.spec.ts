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

    const probe = await browser.newPage();
    const parent = await getFirstParent(probe);
    await probe.close();

    const wallContext = await browser.newContext();
    const phoneContext = await browser.newContext();
    try {
      // On the wall: name it.
      const wall = await openDisplays(wallContext, parent.name);
      await wall.getByLabel('Name for this screen').fill('Kitchen');
      await wall.getByRole('button', { name: 'Name this display' }).click();
      await expect(wall.getByText('This screen is named')).toContainText('Kitchen');
      const wallRow = wall.getByTestId('display-row').filter({ hasText: 'Kitchen' });
      await expect(wallRow).toContainText('This screen');
      await expect(wallRow).toContainText('Online');

      // On the phone: listed, online, and not "this screen".
      const phone = await openDisplays(phoneContext, parent.name);
      const phoneRow = phone.getByTestId('display-row').filter({ hasText: 'Kitchen' });
      await expect(phoneRow).toContainText('Online');
      await expect(phoneRow).not.toContainText('This screen');
      await expect(phone.getByLabel('Name for this screen')).toBeVisible();

      // Rename from the phone; the wall shows it after a refresh.
      await phoneRow.getByRole('button', { name: 'Rename' }).click();
      await phone.getByLabel('New name for Kitchen').fill('Kitchen wall');
      await phone.getByRole('button', { name: 'Save' }).click();
      await expect(phone.getByTestId('display-row').filter({ hasText: 'Kitchen wall' })).toBeVisible();
      await wall.reload();
      await expect(wall.getByText('This screen is named')).toContainText('Kitchen wall');

      // Remove from the phone; the wall's next heartbeat forgets its name.
      phone.once('dialog', (d) => d.accept());
      await phone.getByTestId('display-row').filter({ hasText: 'Kitchen wall' })
        .getByRole('button', { name: 'Remove' }).click();
      await expect(phone.getByTestId('display-row').filter({ hasText: 'Kitchen wall' })).toHaveCount(0);

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
