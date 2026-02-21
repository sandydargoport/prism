import type { WidgetConfig } from '@/lib/hooks/useLayouts';

export interface ScreensaverTemplate {
  name: string;
  description: string;
  orientation: 'landscape' | 'portrait';
  widgets: WidgetConfig[];
}

export const SCREENSAVER_TEMPLATES: Record<string, ScreensaverTemplate> = {
  // ── Landscape Templates ──────────────────────────────────────────
  minimal: {
    name: 'Minimal',
    description: 'Clock and weather, top-right corner',
    orientation: 'landscape',
    widgets: [
      { i: 'clock', x: 8, y: 0, w: 4, h: 3, visible: true },
      { i: 'weather', x: 8, y: 3, w: 4, h: 2, visible: true },
    ],
  },
  photoFrame: {
    name: 'Photo Frame',
    description: 'Small clock and weather overlay — photos fill the screen',
    orientation: 'landscape',
    widgets: [
      { i: 'clock', x: 9, y: 0, w: 3, h: 2, visible: true },
      { i: 'weather', x: 9, y: 2, w: 3, h: 1, visible: true },
    ],
  },
  infoPanel: {
    name: 'Info Panel',
    description: 'Calendar on the left, clock + weather + messages on the right',
    orientation: 'landscape',
    widgets: [
      { i: 'calendar', x: 0, y: 0, w: 5, h: 9, visible: true },
      { i: 'weather', x: 8, y: 0, w: 4, h: 2, visible: true },
      { i: 'messages', x: 8, y: 2, w: 4, h: 4, visible: true },
      { i: 'clock', x: 8, y: 6, w: 4, h: 3, visible: true },
    ],
  },
  familyBoard: {
    name: 'Family Board',
    description: 'Tasks and chores across the top, clock + weather + messages on the right',
    orientation: 'landscape',
    widgets: [
      { i: 'tasks', x: 0, y: 0, w: 4, h: 5, visible: true },
      { i: 'chores', x: 4, y: 0, w: 4, h: 5, visible: true },
      { i: 'weather', x: 8, y: 0, w: 4, h: 2, visible: true },
      { i: 'messages', x: 8, y: 2, w: 4, h: 4, visible: true },
      { i: 'clock', x: 8, y: 6, w: 4, h: 3, visible: true },
    ],
  },
  kitchen: {
    name: 'Kitchen Display',
    description: 'Meals spanning the top, shopping list below, clock + weather on the right',
    orientation: 'landscape',
    widgets: [
      { i: 'meals', x: 0, y: 0, w: 8, h: 4, visible: true },
      { i: 'shopping', x: 0, y: 4, w: 5, h: 5, visible: true },
      { i: 'weather', x: 8, y: 0, w: 4, h: 2, visible: true },
      { i: 'clock', x: 8, y: 2, w: 4, h: 3, visible: true },
    ],
  },
  commandCenter: {
    name: 'Command Center',
    description: 'Full grid with all common widgets',
    orientation: 'landscape',
    widgets: [
      { i: 'calendar', x: 0, y: 0, w: 4, h: 6, visible: true },
      { i: 'tasks', x: 4, y: 0, w: 4, h: 4, visible: true },
      { i: 'messages', x: 8, y: 0, w: 4, h: 4, visible: true },
      { i: 'chores', x: 4, y: 4, w: 4, h: 4, visible: true },
      { i: 'birthdays', x: 8, y: 4, w: 4, h: 4, visible: true },
      { i: 'weather', x: 0, y: 6, w: 4, h: 2, visible: true },
      { i: 'clock', x: 0, y: 8, w: 4, h: 3, visible: true },
    ],
  },

  // ── Portrait Templates ───────────────────────────────────────────
  // Portrait safe zones: 15"=8cols, 24"=9cols, 27"=10cols, 32"=12cols
  // Widgets stay within ~10 columns and stack deep for a vertical feel
  minimalPortrait: {
    name: 'Minimal',
    description: 'Clock and weather centered near the top',
    orientation: 'portrait',
    widgets: [
      { i: 'clock', x: 3, y: 0, w: 4, h: 3, visible: true },
      { i: 'weather', x: 3, y: 3, w: 4, h: 2, visible: true },
    ],
  },
  photoFramePortrait: {
    name: 'Photo Frame',
    description: 'Tiny clock overlay for a tall screen',
    orientation: 'portrait',
    widgets: [
      { i: 'clock', x: 3, y: 0, w: 4, h: 2, visible: true },
      { i: 'weather', x: 3, y: 2, w: 4, h: 1, visible: true },
    ],
  },
  infoPanelPortrait: {
    name: 'Info Panel',
    description: 'Calendar and info stacked vertically',
    orientation: 'portrait',
    widgets: [
      { i: 'calendar', x: 0, y: 0, w: 10, h: 7, visible: true },
      { i: 'clock', x: 0, y: 7, w: 5, h: 3, visible: true },
      { i: 'weather', x: 5, y: 7, w: 5, h: 2, visible: true },
      { i: 'messages', x: 0, y: 10, w: 10, h: 5, visible: true },
    ],
  },
  familyBoardPortrait: {
    name: 'Family Board',
    description: 'Tasks and chores stacked, info below',
    orientation: 'portrait',
    widgets: [
      { i: 'tasks', x: 0, y: 0, w: 10, h: 5, visible: true },
      { i: 'chores', x: 0, y: 5, w: 10, h: 5, visible: true },
      { i: 'weather', x: 0, y: 10, w: 5, h: 2, visible: true },
      { i: 'clock', x: 5, y: 10, w: 5, h: 3, visible: true },
      { i: 'messages', x: 0, y: 13, w: 10, h: 4, visible: true },
    ],
  },
  kitchenPortrait: {
    name: 'Kitchen Display',
    description: 'Meals and shopping stacked for a tall screen',
    orientation: 'portrait',
    widgets: [
      { i: 'meals', x: 0, y: 0, w: 10, h: 5, visible: true },
      { i: 'shopping', x: 0, y: 5, w: 10, h: 6, visible: true },
      { i: 'weather', x: 0, y: 11, w: 5, h: 2, visible: true },
      { i: 'clock', x: 5, y: 11, w: 5, h: 3, visible: true },
    ],
  },
  commandCenterPortrait: {
    name: 'Command Center',
    description: 'All common widgets in a narrow, tall layout',
    orientation: 'portrait',
    widgets: [
      { i: 'calendar', x: 0, y: 0, w: 10, h: 6, visible: true },
      { i: 'tasks', x: 0, y: 6, w: 5, h: 4, visible: true },
      { i: 'messages', x: 5, y: 6, w: 5, h: 4, visible: true },
      { i: 'chores', x: 0, y: 10, w: 5, h: 4, visible: true },
      { i: 'birthdays', x: 5, y: 10, w: 5, h: 4, visible: true },
      { i: 'weather', x: 0, y: 14, w: 5, h: 2, visible: true },
      { i: 'clock', x: 5, y: 14, w: 5, h: 3, visible: true },
    ],
  },
};
