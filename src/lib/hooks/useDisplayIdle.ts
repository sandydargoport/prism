'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether the display is currently showing the screensaver.
 *
 * `document.hidden` is the browser's answer to "is anyone looking at this",
 * and on a wall-mounted display it is never true: the tab is the only tab, in
 * the only window, and it is on screen for weeks. So the visibility pause that
 * every polling hook already has is dead code on exactly the device it was
 * written for. The screensaver coming up is the signal that actually fires
 * there, and it means the same thing — the dashboard underneath is covered and
 * nobody can read it.
 *
 * Deliberately a module-level store rather than a context: useIdleDetection
 * owns timers and window listeners, and the ~20 polling hooks that need to
 * read this must not each instantiate a copy of that. The Screensaver is the
 * single writer.
 */
let idle = false;
const listeners = new Set<() => void>();

/** Publish the display's idle state. Called by the Screensaver, nowhere else. */
export function setDisplayIdle(next: boolean): void {
  if (next === idle) return;
  idle = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): boolean {
  return idle;
}

/** Server render never has a screensaver up, so it is never idle. */
function getServerSnapshot(): boolean {
  return false;
}

export function useDisplayIdle(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
