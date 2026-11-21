import type { Page } from '@playwright/test';

/**
 * This browser edits in place, on the bar over the full screen, rather than
 * opening the canvas editor, which every device does now (#1280). Only for the
 * specs that still measure the editor in place; they move onto the canvas in
 * #1283, and this goes with them. The key is editPlace.ts's
 * EDIT_IN_PLACE_KEY.
 */
export const EDIT_HERE_KEY = 'prism:test-edit-in-place';

export async function editHere(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    try { localStorage.setItem(key, '1'); } catch { /* storage blocked */ }
  }, EDIT_HERE_KEY);
  if (page.url().startsWith('http')) await page.evaluate((key) => localStorage.setItem(key, '1'), EDIT_HERE_KEY);
}
