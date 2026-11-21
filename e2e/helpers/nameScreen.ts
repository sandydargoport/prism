import { expect, type Page } from '@playwright/test';
import { editHere } from './editHere';

/**
 * Names this browser as a screen, or makes it a screen named before, from its
 * own editor's Through the day sheet (#1267): Settings > Screens is only the
 * list. Leaves the editor and returns once the server has it as this browser's
 * screen. A screen named before that brings settings reloads the page.
 */
export async function nameThisScreen(page: Page, name: string, how: 'new' | 'existing' = 'new'): Promise<void> {
  await editHere(page);
  await page.goto('/?edit=1');
  await page.locator('[data-editor-open="day"]').click({ timeout: 90_000 });
  const sheet = page.locator('[data-editor-sheet="day"]');
  await sheet.locator('[data-name-device-open]').click();
  if (how === 'existing') {
    await sheet.getByLabel('Existing screen').selectOption({ label: name });
    await sheet.getByRole('button', { name: 'Use its name and settings' }).click();
  } else {
    await sheet.getByLabel('Name for this screen').fill(name);
    await sheet.getByRole('button', { name: 'Name it' }).click();
  }
  await expect.poll(async () => {
    const { displays, currentId } = await (await page.request.get('/api/displays')).json();
    return displays.find((d: { id: string }) => d.id === currentId)?.name ?? null;
  }, { timeout: 30_000 }).toBe(name);
  // Out of the editor, unless naming it reloaded the page.
  const cancel = page.locator('[data-editor-cancel]');
  if (await cancel.isVisible().catch(() => false)) await cancel.click();
}
