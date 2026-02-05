import type { WidgetConfig } from '@/lib/hooks/useLayouts';

export interface LayoutTemplate {
  name: string;
  description: string;
  widgets: WidgetConfig[];
}

// Grid: 12 columns x ~24 rows (each row ~40px on 1080p)
// Widget sizes are relative to this grid

export const LAYOUT_TEMPLATES: Record<string, LayoutTemplate> = {
  familyCentral: {
    name: 'Family Central',
    description: 'Balanced layout with calendar, tasks, and family features',
    widgets: [
      { i: 'calendar', x: 0, y: 0, w: 7, h: 12 },
      { i: 'clock', x: 7, y: 0, w: 5, h: 4 },
      { i: 'weather', x: 7, y: 4, w: 5, h: 4 },
      { i: 'tasks', x: 7, y: 8, w: 5, h: 8 },
      { i: 'messages', x: 0, y: 12, w: 4, h: 8 },
      { i: 'chores', x: 4, y: 12, w: 4, h: 8 },
      { i: 'birthdays', x: 8, y: 16, w: 4, h: 4 },
    ],
  },

  taskMaster: {
    name: 'Task Master',
    description: 'Tasks and chores front and center',
    widgets: [
      { i: 'tasks', x: 0, y: 0, w: 6, h: 12 },
      { i: 'chores', x: 6, y: 0, w: 6, h: 12 },
      { i: 'clock', x: 0, y: 12, w: 3, h: 4 },
      { i: 'weather', x: 3, y: 12, w: 3, h: 4 },
      { i: 'calendar', x: 6, y: 12, w: 6, h: 8 },
      { i: 'shopping', x: 0, y: 16, w: 6, h: 4 },
    ],
  },

  calendarFocus: {
    name: 'Calendar Focus',
    description: 'Large calendar with compact info sidebar',
    widgets: [
      { i: 'calendar', x: 0, y: 0, w: 9, h: 16 },
      { i: 'clock', x: 9, y: 0, w: 3, h: 4 },
      { i: 'weather', x: 9, y: 4, w: 3, h: 4 },
      { i: 'tasks', x: 9, y: 8, w: 3, h: 6 },
      { i: 'birthdays', x: 9, y: 14, w: 3, h: 4 },
      { i: 'messages', x: 0, y: 16, w: 6, h: 4 },
    ],
  },

  commandCenter: {
    name: 'Command Center',
    description: 'Everything visible at a glance',
    widgets: [
      { i: 'clock', x: 0, y: 0, w: 4, h: 4 },
      { i: 'weather', x: 4, y: 0, w: 4, h: 4 },
      { i: 'birthdays', x: 8, y: 0, w: 4, h: 4 },
      { i: 'calendar', x: 0, y: 4, w: 6, h: 8 },
      { i: 'tasks', x: 6, y: 4, w: 6, h: 8 },
      { i: 'chores', x: 0, y: 12, w: 4, h: 6 },
      { i: 'shopping', x: 4, y: 12, w: 4, h: 6 },
      { i: 'messages', x: 8, y: 12, w: 4, h: 6 },
      { i: 'meals', x: 0, y: 18, w: 12, h: 4 },
    ],
  },

  minimal: {
    name: 'Minimal',
    description: 'Clean and simple - just the essentials',
    widgets: [
      { i: 'clock', x: 0, y: 0, w: 6, h: 6 },
      { i: 'weather', x: 6, y: 0, w: 6, h: 6 },
      { i: 'calendar', x: 0, y: 6, w: 8, h: 10 },
      { i: 'tasks', x: 8, y: 6, w: 4, h: 10 },
    ],
  },

  mealPlanner: {
    name: 'Meal Planner',
    description: 'Focus on meals and shopping',
    widgets: [
      { i: 'meals', x: 0, y: 0, w: 8, h: 10 },
      { i: 'clock', x: 8, y: 0, w: 4, h: 4 },
      { i: 'weather', x: 8, y: 4, w: 4, h: 3 },
      { i: 'calendar', x: 8, y: 7, w: 4, h: 6 },
      { i: 'shopping', x: 0, y: 10, w: 6, h: 8 },
      { i: 'tasks', x: 6, y: 10, w: 6, h: 8 },
    ],
  },
};

export const DEFAULT_TEMPLATE: LayoutTemplate = LAYOUT_TEMPLATES.familyCentral!;
