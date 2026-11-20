import type { Page } from '@playwright/test';

/**
 * This browser edits on itself, as a named screen does, rather than opening
 * the canvas editor (#1265). For specs about the editor in place.
 */
export const EDIT_HERE_KEY = 'prism:edit-here';

export async function editHere(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    try { localStorage.setItem(key, '1'); } catch { /* storage blocked */ }
  }, EDIT_HERE_KEY);
  if (page.url().startsWith('http')) await page.evaluate((key) => localStorage.setItem(key, '1'), EDIT_HERE_KEY);
}
