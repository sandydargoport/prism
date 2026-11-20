'use client';

/**
 * Where Edit opens (#1265).
 *
 * A named screen edits on itself, at full size, with the panels over it. So
 * does the frame of the canvas editor, which is a dashboard laid out at a
 * screen's size. Anything else, a laptop most of all, edits on a canvas: the
 * dashboard at the size of the screen that shows it, scaled to fit beside the
 * panels, so what is arranged is what the wall will show.
 *
 * A device that is a screen but was never named can choose "Here, full size"
 * in the canvas editor; it then edits on itself from then on, and "Edit on a
 * canvas" in the Look panel takes that back.
 */
import { isNamedScreen } from './namedScreen';
import { remoteEditHost } from './remoteEdit';

/** This device edits in place, though it is not a named screen. */
export const EDIT_HERE_KEY = 'prism:edit-here';

/** The canvas editor for a dashboard. */
export function canvasEditLink(dashboardId: string): string {
  return `/edit/${encodeURIComponent(dashboardId)}`;
}

/** This device chose to edit on itself. */
export function editsHereByChoice(): boolean {
  try {
    return window.localStorage.getItem(EDIT_HERE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setEditHere(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(EDIT_HERE_KEY, '1');
    else window.localStorage.removeItem(EDIT_HERE_KEY);
  } catch {
    // Storage blocked: Edit keeps opening the canvas.
  }
}

/** Edit opens the canvas editor rather than editing in place. */
export function editsOnCanvas(): boolean {
  if (typeof window === 'undefined') return false;
  if (remoteEditHost()) return false;
  if (isNamedScreen()) return false;
  return !editsHereByChoice();
}
