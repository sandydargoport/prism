import type { WidgetConfig } from '@/lib/hooks/useLayouts';

export interface ScreensaverTemplate {
  name: string;
  description: string;
  widgets: WidgetConfig[];
}

export const SCREENSAVER_TEMPLATES: Record<string, ScreensaverTemplate> = {
  minimal: {
    name: 'Minimal',
    description: 'Clock and weather, top-right corner',
    widgets: [
      { i: 'clock', x: 8, y: 0, w: 4, h: 3, visible: true },
      { i: 'weather', x: 8, y: 3, w: 4, h: 2, visible: true },
    ],
  },
  photoFrame: {
    name: 'Photo Frame',
    description: 'Small clock and weather overlay — photos fill the screen',
    widgets: [
      { i: 'clock', x: 9, y: 0, w: 3, h: 2, visible: true },
      { i: 'weather', x: 9, y: 2, w: 3, h: 1, visible: true },
    ],
  },
  infoPanel: {
    name: 'Info Panel',
    description: 'Calendar on the left, clock + weather + messages on the right',
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
};
