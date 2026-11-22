import { expect, type FrameLocator, type Page } from '@playwright/test';

/**
 * The editor every device uses (#1265, #1280, #1283): the dashboard being
 * arranged is drawn in a frame at the screen's size, and the panels are on
 * the page beside it. A device nobody named opens /edit/<dashboard>, a named
 * screen its own /screens/<id>. One panel is always open; none closes.
 */
export type Panel = 'dashboard' | 'widgets' | 'day' | 'look' | 'more';

/**
 * Waits for Edit to land on the canvas: the address, the dashboard in the
 * frame (the widget `widget` when given; Today has no grid of widgets), and
 * the panels. Returns the frame.
 */
export async function onCanvas(page: Page, widget?: string): Promise<FrameLocator> {
  await page.waitForURL((u) => /^\/(edit|screens)\//.test(u.pathname), { timeout: 60_000 });
  const frame = page.frameLocator('[data-remote-frame]');
  const shown = widget ? frame.locator(`[data-editor-widget="${widget}"]`) : frame.locator('main').first();
  await expect(shown).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('[data-remote-edit-root] [data-editor-panels]')).toBeVisible({ timeout: 60_000 });
  return frame;
}

/**
 * Opens a dashboard's editor from its address, as its Edit link does (`slug`,
 * or the home page's for null), signed in as a parent already. Returns the frame.
 */
export async function editOnCanvas(page: Page, slug: string | null, widget?: string): Promise<FrameLocator> {
  await page.goto(slug ? `/d/${slug}?edit=1` : '/?edit=1');
  return onCanvas(page, widget);
}

/** Opens a panel by its tab. */
export async function openPanel(page: Page, id: Panel): Promise<void> {
  await page.locator(`[data-editor-open="${id}"]`).click();
  await expect(page.locator(`[data-editor-sheet="${id}"]`)).toBeVisible();
}
