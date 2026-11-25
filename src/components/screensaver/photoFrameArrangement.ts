'use client';

import { useSyncExternalStore } from 'react';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import { DEFAULT_SCREENSAVER_LAYOUT } from './screensaverStorage';

/**
 * The photo frame's arrangement (#1346): the widgets of the dashboard the
 * screen shows, as saved on that dashboard (`layouts.screensaver_widgets`).
 *
 * The Dashboard publishes it while it is open, and again whenever its saved
 * copy changes, an edit from another device included; the running photo frame
 * reads it from here. It used to read a copy kept in this browser, written
 * once when the dashboard opened, so an edit from elsewhere waited for a
 * reload. A module-level store for the same reason as calmMode's: the two
 * sit in different parts of the tree.
 *
 * Off a dashboard (Settings, a list) it keeps the last one published, the
 * arrangement of the dashboard the screen last showed.
 */
let value: WidgetConfig[] = DEFAULT_SCREENSAVER_LAYOUT;
let key = JSON.stringify(value);
const listeners = new Set<() => void>();

/** Publish the arrangement of the dashboard shown. Called by the Dashboard. */
export function setPhotoFrameArrangement(next: WidgetConfig[]): void {
  // The same arrangement fetched again is not a change: the photo frame
  // would restart its rotation for nothing.
  const nextKey = JSON.stringify(next);
  if (nextKey === key) return;
  value = next;
  key = nextKey;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The arrangement published last. */
export const currentPhotoFrameArrangement = (): WidgetConfig[] => value;
const get = currentPhotoFrameArrangement;
const initial = () => DEFAULT_SCREENSAVER_LAYOUT;

/** The arrangement the running photo frame shows. */
export function usePhotoFrameArrangement(): WidgetConfig[] {
  return useSyncExternalStore(subscribe, get, initial);
}

/** For tests: back to the default. */
export function resetPhotoFrameArrangement(): void {
  setPhotoFrameArrangement(DEFAULT_SCREENSAVER_LAYOUT);
}
