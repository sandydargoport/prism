import { expect, type Page } from '@playwright/test';

/**
 * Names this browser as a screen, or makes it a screen named before, from its
 * own editor's Through the day sheet (#1267): Settings > Screens is only the
 * list. A device nobody named edits on the canvas (#1280), and once named it
 * opens its own screen's editor (#1282). Leaves the editor and returns once
 * the server has it as this browser's screen.
 */
export async function nameThisScreen(page: Page, name: string, how: 'new' | 'existing' = 'new'): Promise<void> {
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
  // Named, it opens its own screen's editor (#1282); out of that, onto its dashboard.
  await page.waitForURL(/\/screens\//, { timeout: 60_000 });
  const cancel = page.locator('[data-editor-cancel]');
  if (await cancel.waitFor({ state: 'visible', timeout: 60_000 }).then(() => true, () => false)) await cancel.click();
  await page.waitForURL((u) => !u.pathname.startsWith('/screens/') && !u.pathname.startsWith('/edit/'), { timeout: 60_000 });
}
