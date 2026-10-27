'use client';

import { useSyncExternalStore } from 'react';
import type { ScreensaverMode, WidgetConfig } from '@/lib/hooks/useLayouts';

/**
 * Calm mode (#691): the dashboard is its own idle screen. When the display goes
 * idle, the widgets not marked to stay fade out and the rest stay exactly where
 * they are; a tap brings everything back. Nothing changes place; the widgets
 * that stay only drift, a few pixels at a time, to spare the panel.
 *
 * The Screensaver still owns idleness (timers, the toolbar button, Away and
 * Babysitter yielding), so two facts cross between it and the dashboard:
 *
 *  - which mode the dashboard on screen uses, published by the Dashboard while
 *    it is mounted. Any other page, or no dashboard, is 'separate', so a
 *    display left on the calendar page still gets the ordinary screensaver.
 *  - whether a calm display is idle right now, published by the Screensaver.
 *
 * Both are module-level stores for the same reason useDisplayIdle is one: the
 * two components sit in different parts of the tree.
 */

/** Widgets that stay on a calm idle screen unless the widget says otherwise. */
export const DEFAULT_IDLE_WIDGETS: ReadonlySet<string> = new Set(['clock', 'weather', 'calendar']);

/**
 * Whether a widget stays on screen while a calm display is idle.
 *
 * The one place this is decided, so later rules (hide when empty, #738) join
 * here rather than at each caller.
 */
export function shownWhenIdle(widget: WidgetConfig): boolean {
  return widget.showWhenIdle ?? DEFAULT_IDLE_WIDGETS.has(widget.i);
}

function createStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    set(next: T) {
      if (next === value) return;
      value = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    get: () => value,
    initial: () => initial,
  };
}

const activeMode = createStore<ScreensaverMode>('separate');
const calmIdle = createStore(false);

/** Publish the mode of the dashboard on screen. Called by the Dashboard. */
export const setActiveScreensaverMode = activeMode.set;

export function useActiveScreensaverMode(): ScreensaverMode {
  return useSyncExternalStore(activeMode.subscribe, activeMode.get, activeMode.initial);
}

/** Publish whether a calm display is idle. Called by the Screensaver. */
export const setCalmIdle = calmIdle.set;

export function useCalmIdle(): boolean {
  return useSyncExternalStore(calmIdle.subscribe, calmIdle.get, calmIdle.initial);
}
