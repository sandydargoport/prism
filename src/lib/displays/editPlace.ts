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

/**
 * Edit opens a canvas editor rather than editing in place: everywhere but in
 * the canvas's own frame (#1283).
 */
export function editsOnCanvas(): boolean {
  if (typeof window === 'undefined') return false;
  return !remoteEditHost();
}
