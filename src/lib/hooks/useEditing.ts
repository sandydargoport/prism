'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { remoteEditHost } from '@/lib/displays/remoteEdit';

/**
 * Whether a dashboard is being edited on this page (#1342).
 *
 * The screen does not go idle while it is: no photo frame, no dim, no calm
 * idle over the editor. Three places edit:
 *
 *  - a dashboard in edit mode (on the wall, or `?edit=1`), held by
 *    useDashboardLayout while it is in edit mode;
 *  - the editor page (/screens/[id], /edit/[id]), held by CanvasEditor while
 *    it is open, since the picture is in a frame and taps there never reach
 *    this page's idle timer;
 *  - the frame inside that page, which renders the screen: it is editing for
 *    as long as it lives (remoteEdit.ts).
 *
 * A module-level store, like useDisplayIdle, so the Screensaver can read what
 * the dashboard and the editor publish from other parts of the tree.
 */
let holds = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Hold editing on until the returned release is called. */
export function holdEditing(): () => void {
  holds += 1;
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds -= 1;
    emit();
  };
}

/** Whether anything on this page is editing right now. */
export function isEditing(): boolean {
  return holds > 0 || remoteEditHost() !== null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The server render edits nothing. */
const serverSnapshot = () => false;

export function useEditing(): boolean {
  return useSyncExternalStore(subscribe, isEditing, serverSnapshot);
}

/** Hold editing on while `on` is true (and the component is mounted). */
export function useHoldEditing(on: boolean): void {
  useEffect(() => (on ? holdEditing() : undefined), [on]);
}
