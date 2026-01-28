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
      { i: 'calendar', x: 0, y: 0, w: 2, h: 2 },
      { i: 'clock', x: 2, y: 0, w: 1, h: 1 },
      { i: 'weather', x: 3, y: 0, w: 1, h: 2 },
      { i: 'tasks', x: 2, y: 1, w: 1, h: 2 },
      { i: 'messages', x: 0, y: 2, w: 1, h: 2 },
      { i: 'chores', x: 1, y: 2, w: 1, h: 2 },
      { i: 'shopping', x: 3, y: 2, w: 1, h: 2 },
      { i: 'birthdays', x: 0, y: 4, w: 1, h: 2 },
      { i: 'meals', x: 1, y: 4, w: 2, h: 2 },
    ],
  },

  taskMaster: {
    name: 'Task Master',
    description: 'Emphasizes tasks and chores with a compact calendar',
    widgets: [
      { i: 'tasks', x: 0, y: 0, w: 2, h: 3 },
      { i: 'chores', x: 2, y: 0, w: 2, h: 3 },
      { i: 'calendar', x: 0, y: 3, w: 2, h: 2 },
      { i: 'shopping', x: 2, y: 3, w: 1, h: 2 },
      { i: 'clock', x: 3, y: 3, w: 1, h: 1 },
      { i: 'weather', x: 3, y: 4, w: 1, h: 1 },
    ],
  },

  photoFrame: {
    name: 'Photo Frame',
    description: 'Large photo area with a minimal info strip',
    widgets: [
      { i: 'calendar', x: 0, y: 0, w: 3, h: 3 },
      { i: 'clock', x: 3, y: 0, w: 1, h: 1 },
      { i: 'weather', x: 3, y: 1, w: 1, h: 1 },
      { i: 'birthdays', x: 3, y: 2, w: 1, h: 1 },
      { i: 'messages', x: 0, y: 3, w: 2, h: 2 },
      { i: 'tasks', x: 2, y: 3, w: 2, h: 2 },
    ],
  },

  commandCenter: {
    name: 'Command Center',
    description: 'Equal 3x3 grid with all widgets visible',
    widgets: [
      { i: 'clock', x: 0, y: 0, w: 1, h: 1 },
      { i: 'weather', x: 1, y: 0, w: 1, h: 1 },
      { i: 'calendar', x: 2, y: 0, w: 2, h: 2 },
      { i: 'tasks', x: 0, y: 1, w: 1, h: 2 },
      { i: 'messages', x: 1, y: 1, w: 1, h: 2 },
      { i: 'chores', x: 0, y: 3, w: 1, h: 2 },
      { i: 'shopping', x: 1, y: 3, w: 1, h: 2 },
      { i: 'birthdays', x: 2, y: 2, w: 1, h: 2 },
      { i: 'meals', x: 3, y: 2, w: 1, h: 2 },
    ],
  },

  cleanAndSimple: {
    name: 'Clean & Simple',
    description: 'Large clock, weather, and today\'s agenda only',
    widgets: [
      { i: 'clock', x: 0, y: 0, w: 2, h: 2 },
      { i: 'weather', x: 2, y: 0, w: 2, h: 2 },
      { i: 'calendar', x: 0, y: 2, w: 2, h: 2 },
      { i: 'tasks', x: 2, y: 2, w: 2, h: 2 },
    ],
  },
};

export const DEFAULT_TEMPLATE: LayoutTemplate = {
  name: 'Family Central',
  description: 'Default layout with calendar, clock, weather, and all widgets',
  widgets: LAYOUT_TEMPLATES.familyCentral!.widgets,
};
