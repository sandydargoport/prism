import type { WidgetConfig } from '@/lib/hooks/useLayouts';

export interface ScreensaverTemplate {
  name: string;
  description: string;
  orientation: 'landscape' | 'portrait';
  widgets: WidgetConfig[];
}

// Screensavers are ambient: less is more. A few widgets float over the
// wallpaper/photos with generous empty space. Kept well within the visible
// area (landscape widgets stay above ~row 20, portrait above ~row 38) so
// nothing runs off the bottom on smaller displays. 48-column grid.

export const SCREENSAVER_TEMPLATES: Record<string, ScreensaverTemplate> = {
  // ── Landscape Templates ──────────────────────────────────────────
  minimal: {
    name: 'Minimal',
    description: 'Just a clock and weather, top-right',
    orientation: 'landscape',
    widgets: [
      { i: 'clock', x: 31, y: 2, w: 15, h: 9, visible: true },
      { i: 'weather', x: 31, y: 12, w: 15, h: 6, visible: true },
    ],
  },
  photoFrame: {
    name: 'Photo Frame',
    description: 'A small clock + weather overlay — photos fill the screen',
    orientation: 'landscape',
    widgets: [
      { i: 'clock', x: 34, y: 2, w: 13, h: 6, visible: true },
      { i: 'weather', x: 34, y: 9, w: 13, h: 5, visible: true },
    ],
  },
  infoPanel: {
    name: 'Info Panel',
    description: 'Calendar on the left, clock + weather + messages on the right',
    orientation: 'landscape',
    widgets: [
      { i: 'calendar', x: 2, y: 2, w: 22, h: 16, visible: true },
      { i: 'weather', x: 27, y: 2, w: 19, h: 5, visible: true },
      { i: 'messages', x: 27, y: 8, w: 19, h: 6, visible: true },
      { i: 'clock', x: 27, y: 15, w: 19, h: 5, visible: true },
    ],
  },
  familyBoard: {
    name: 'Family Board',
    description: 'Tasks + chores, with clock, weather and messages alongside',
    orientation: 'landscape',
    widgets: [
      { i: 'tasks', x: 2, y: 2, w: 14, h: 16, visible: true },
      { i: 'chores', x: 17, y: 2, w: 14, h: 16, visible: true },
      { i: 'weather', x: 33, y: 2, w: 13, h: 5, visible: true },
      { i: 'messages', x: 33, y: 8, w: 13, h: 6, visible: true },
      { i: 'clock', x: 33, y: 15, w: 13, h: 5, visible: true },
    ],
  },
  kitchen: {
    name: 'Kitchen Display',
    description: 'Meals over shopping, with clock + weather on the right',
    orientation: 'landscape',
    widgets: [
      { i: 'meals', x: 2, y: 2, w: 28, h: 10, visible: true },
      { i: 'shopping', x: 2, y: 13, w: 28, h: 7, visible: true },
      { i: 'weather', x: 32, y: 2, w: 14, h: 6, visible: true },
      { i: 'clock', x: 32, y: 9, w: 14, h: 11, visible: true },
    ],
  },
  commandCenter: {
    name: 'Command Center',
    description: 'Calendar with a compact clock / weather / messages column',
    orientation: 'landscape',
    widgets: [
      { i: 'calendar', x: 2, y: 2, w: 20, h: 16, visible: true },
      { i: 'weather', x: 24, y: 2, w: 22, h: 5, visible: true },
      { i: 'clock', x: 24, y: 8, w: 22, h: 5, visible: true },
      { i: 'messages', x: 24, y: 14, w: 22, h: 6, visible: true },
    ],
  },

  // ── Portrait Templates ───────────────────────────────────────────
  minimalPortrait: {
    name: 'Minimal',
    description: 'Clock and weather near the top',
    orientation: 'portrait',
    widgets: [
      { i: 'clock', x: 10, y: 5, w: 28, h: 11, visible: true },
      { i: 'weather', x: 10, y: 17, w: 28, h: 7, visible: true },
    ],
  },
  photoFramePortrait: {
    name: 'Photo Frame',
    description: 'A tiny clock + weather overlay for a tall screen',
    orientation: 'portrait',
    widgets: [
      { i: 'clock', x: 16, y: 4, w: 16, h: 8, visible: true },
      { i: 'weather', x: 16, y: 13, w: 16, h: 5, visible: true },
    ],
  },
  infoPanelPortrait: {
    name: 'Info Panel',
    description: 'Calendar up top, clock + weather + messages below',
    orientation: 'portrait',
    widgets: [
      { i: 'calendar', x: 2, y: 2, w: 44, h: 20, visible: true },
      { i: 'clock', x: 2, y: 24, w: 21, h: 8, visible: true },
      { i: 'weather', x: 25, y: 24, w: 21, h: 8, visible: true },
      { i: 'messages', x: 2, y: 33, w: 44, h: 5, visible: true },
    ],
  },
  familyBoardPortrait: {
    name: 'Family Board',
    description: 'Tasks and chores stacked, clock + weather below',
    orientation: 'portrait',
    widgets: [
      { i: 'tasks', x: 2, y: 2, w: 44, h: 13, visible: true },
      { i: 'chores', x: 2, y: 16, w: 44, h: 12, visible: true },
      { i: 'weather', x: 2, y: 29, w: 21, h: 7, visible: true },
      { i: 'clock', x: 25, y: 29, w: 21, h: 7, visible: true },
    ],
  },
  kitchenPortrait: {
    name: 'Kitchen Display',
    description: 'Meals and shopping stacked for a tall screen',
    orientation: 'portrait',
    widgets: [
      { i: 'meals', x: 2, y: 2, w: 44, h: 14, visible: true },
      { i: 'shopping', x: 2, y: 17, w: 44, h: 12, visible: true },
      { i: 'weather', x: 2, y: 30, w: 21, h: 7, visible: true },
      { i: 'clock', x: 25, y: 30, w: 21, h: 7, visible: true },
    ],
  },
  commandCenterPortrait: {
    name: 'Command Center',
    description: 'Calendar with tasks, messages, clock and weather below',
    orientation: 'portrait',
    widgets: [
      { i: 'calendar', x: 2, y: 2, w: 44, h: 16, visible: true },
      { i: 'tasks', x: 2, y: 19, w: 21, h: 9, visible: true },
      { i: 'messages', x: 25, y: 19, w: 21, h: 9, visible: true },
      { i: 'weather', x: 2, y: 29, w: 21, h: 7, visible: true },
      { i: 'clock', x: 25, y: 29, w: 21, h: 7, visible: true },
    ],
  },
};
