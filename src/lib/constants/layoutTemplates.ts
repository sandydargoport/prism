import type { WidgetConfig } from '@/lib/hooks/useLayouts';

export interface LayoutTemplate {
  name: string;
  description: string;
  widgets: WidgetConfig[];
}

export const LAYOUT_TEMPLATES: Record<string, LayoutTemplate> = {
  familyCentral: {
    name: 'Family Central',
    description: 'Default layout with calendar, clock, weather, and all widgets',
    widgets: [
      { i: 'calendar', x: 0, y: 0, w: 6, h: 6 },
      { i: 'clock', x: 6, y: 0, w: 3, h: 3 },
      { i: 'weather', x: 9, y: 0, w: 3, h: 6 },
      { i: 'tasks', x: 6, y: 3, w: 3, h: 6 },
      { i: 'messages', x: 0, y: 6, w: 3, h: 6 },
      { i: 'chores', x: 3, y: 6, w: 3, h: 6 },
      { i: 'shopping', x: 9, y: 6, w: 3, h: 6 },
      { i: 'birthdays', x: 0, y: 12, w: 3, h: 6 },
      { i: 'meals', x: 3, y: 12, w: 6, h: 6 },
    ],
  },

  taskMaster: {
    name: 'Task Master',
    description: 'Emphasizes tasks and chores with a compact calendar',
    widgets: [
      { i: 'tasks', x: 0, y: 0, w: 6, h: 9 },
      { i: 'chores', x: 6, y: 0, w: 6, h: 9 },
      { i: 'calendar', x: 0, y: 9, w: 6, h: 6 },
      { i: 'shopping', x: 6, y: 9, w: 3, h: 6 },
      { i: 'clock', x: 9, y: 9, w: 3, h: 3 },
      { i: 'weather', x: 9, y: 12, w: 3, h: 3 },
    ],
  },

  photoFrame: {
    name: 'Photo Frame',
    description: 'Large photo area with a minimal info strip',
    widgets: [
      { i: 'calendar', x: 0, y: 0, w: 9, h: 9 },
      { i: 'clock', x: 9, y: 0, w: 3, h: 3 },
      { i: 'weather', x: 9, y: 3, w: 3, h: 3 },
      { i: 'birthdays', x: 9, y: 6, w: 3, h: 3 },
      { i: 'messages', x: 0, y: 9, w: 6, h: 6 },
      { i: 'tasks', x: 6, y: 9, w: 6, h: 6 },
    ],
  },

  commandCenter: {
    name: 'Command Center',
    description: 'Equal 3x3 grid with all widgets visible',
    widgets: [
      { i: 'clock', x: 0, y: 0, w: 3, h: 3 },
      { i: 'weather', x: 3, y: 0, w: 3, h: 3 },
      { i: 'calendar', x: 6, y: 0, w: 6, h: 6 },
      { i: 'tasks', x: 0, y: 3, w: 3, h: 6 },
      { i: 'messages', x: 3, y: 3, w: 3, h: 6 },
      { i: 'chores', x: 0, y: 9, w: 3, h: 6 },
      { i: 'shopping', x: 3, y: 9, w: 3, h: 6 },
      { i: 'birthdays', x: 6, y: 6, w: 3, h: 6 },
      { i: 'meals', x: 9, y: 6, w: 3, h: 6 },
    ],
  },

  cleanAndSimple: {
    name: 'Clean & Simple',
    description: 'Large clock, weather, and today\'s agenda only',
    widgets: [
      { i: 'clock', x: 0, y: 0, w: 6, h: 6 },
      { i: 'weather', x: 6, y: 0, w: 6, h: 6 },
      { i: 'calendar', x: 0, y: 6, w: 6, h: 6 },
      { i: 'tasks', x: 6, y: 6, w: 6, h: 6 },
    ],
  },
};

export const DEFAULT_TEMPLATE: LayoutTemplate = {
  name: 'Family Central',
  description: 'Default layout with calendar, clock, weather, and all widgets',
  widgets: LAYOUT_TEMPLATES.familyCentral!.widgets,
};
