'use client';

/**
 * Where Edit opens (#1265, #1280).
 *
 * Every device edits on a canvas: the dashboard laid out at the size of the
 * screen that shows it, scaled to fit beside the panels, so what is arranged
 * is what the wall will show. A named screen opens its own screen's editor,
 * at its own size, so the editor looks the same on the wall, a laptop and a
 * phone. Only the canvas's frame edits in place, since it is the dashboard
 * the canvas shows.
 */
import { MOBILE_BREAKPOINT } from '@/lib/hooks/useIsMobile';
import { loadBase } from './displaySettingsSync';
import { isNamedScreen } from './namedScreen';
import { remoteEditHost } from './remoteEdit';

/**
 * Set only by the browser specs that still measure the editor in place, on
 * the bar over the full screen; nothing a person can press sets it. Those
 * specs move onto the canvas in #1283, and this goes with them.
 */
export const EDIT_IN_PLACE_KEY = 'prism:test-edit-in-place';

/** The canvas editor for a dashboard. */
export function canvasEditLink(dashboardId: string): string {
  return `/edit/${encodeURIComponent(dashboardId)}`;
}

/** A screen's own editor, opening on `dashboardId` when given. */
export function screenEditLink(screenId: string, dashboardId?: string): string {
  const at = dashboardId ? `?dashboard=${encodeURIComponent(dashboardId)}` : '';
  return `/screens/${encodeURIComponent(screenId)}${at}`;
}

/** The screen this browser is, when it is a named one and knows its id. */
export function ownScreenId(): string | null {
  if (!isNamedScreen()) return null;
  return loadBase()?.displayId ?? null;
}

/**
 * Where Edit on `dashboardId` goes: this screen's editor on a named screen,
 * the dashboard's canvas elsewhere. A named screen as narrow as a phone shows
 * the phone layout of cards, with no grid to arrange on it, so it edits the
 * dashboard as any phone does.
 */
export function editorLink(dashboardId: string): string {
  const own = ownScreenId();
  return own && window.innerWidth >= MOBILE_BREAKPOINT ? screenEditLink(own, dashboardId) : canvasEditLink(dashboardId);
}

function editsInPlace(): boolean {
  try {
    return window.localStorage.getItem(EDIT_IN_PLACE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Edit opens a canvas editor rather than editing in place. */
export function editsOnCanvas(): boolean {
  if (typeof window === 'undefined') return false;
  if (remoteEditHost()) return false;
  return !editsInPlace();
}
