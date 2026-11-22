'use client';

import type { EditorSheet } from './EditorBar';

/**
 * The canvas editor stays on Dashboard when one is picked there (#1278).
 *
 * Picking another dashboard loads it in the canvas's frame, which starts a new
 * editor, and a new one opens on Widgets. So the pick leaves a note for the
 * dashboard picked, and its editor opens on Dashboard instead. The note is
 * kept for this tab only and read once.
 */
const KEY = 'prism:canvas-panel-next';

type Note = { panel: EditorSheet; dashboardId: string };

/** The next editor, on `dashboardId`, opens on `panel`. */
export function keepPanelFor(dashboardId: string, panel: EditorSheet): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ panel, dashboardId } satisfies Note));
  } catch { /* no storage: it opens on Widgets, as before */ }
}

/** The panel the editor on `dashboardId` was asked to open on, if any. */
export function panelKeptFor(dashboardId: string | undefined): EditorSheet | null {
  if (!dashboardId) return null;
  try {
    const note = JSON.parse(window.sessionStorage.getItem(KEY) ?? 'null') as Note | null;
    return note?.dashboardId === dashboardId ? note.panel : null;
  } catch {
    return null;
  }
}

/** The note has been used. */
export function forgetKeptPanel(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch { /* nothing kept */ }
}
