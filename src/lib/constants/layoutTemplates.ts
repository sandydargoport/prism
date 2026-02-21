import type { WidgetConfig } from '@/lib/hooks/useLayouts';

export interface LayoutTemplate {
  name: string;
  description: string;
  orientation: 'landscape' | 'portrait';
  widgets: WidgetConfig[];
}

// Grid: 12 columns x ~24 rows (each row ~40px on 1080p)
// Widget sizes are relative to this grid

export const LAYOUT_TEMPLATES: Record<string, LayoutTemplate> = {
  // ── Landscape Templates ──────────────────────────────────────────
  familyCentral: {
    name: 'Family Central',
    description: 'Balanced layout with calendar, tasks, and family features',
    orientation: 'landscape',
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
    orientation: 'landscape',
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
    orientation: 'landscape',
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
    orientation: 'landscape',
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
    orientation: 'landscape',
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
    orientation: 'landscape',
    widgets: [
      { i: 'meals', x: 0, y: 0, w: 8, h: 10 },
      { i: 'clock', x: 8, y: 0, w: 4, h: 4 },
      { i: 'weather', x: 8, y: 4, w: 4, h: 3 },
      { i: 'calendar', x: 8, y: 7, w: 4, h: 6 },
      { i: 'shopping', x: 0, y: 10, w: 6, h: 8 },
      { i: 'tasks', x: 6, y: 10, w: 6, h: 8 },
    ],
  },

  // ── Portrait Templates ───────────────────────────────────────────
  // Portrait safe zones: 15"=8cols/12rows, 24"=9cols/14rows, 27"=10cols/18rows, 32"=12cols/22rows
  // Widgets stay within ~10 columns and stack deep for a vertical feel
  familyCentralPortrait: {
    name: 'Family Central',
    description: 'Vertically stacked with calendar as the centerpiece',
    orientation: 'portrait',
    widgets: [
      { i: 'clock', x: 0, y: 0, w: 5, h: 3 },
      { i: 'weather', x: 5, y: 0, w: 5, h: 3 },
      { i: 'calendar', x: 0, y: 3, w: 10, h: 8 },
      { i: 'tasks', x: 0, y: 11, w: 5, h: 5 },
      { i: 'chores', x: 5, y: 11, w: 5, h: 5 },
      { i: 'messages', x: 0, y: 16, w: 10, h: 4 },
      { i: 'birthdays', x: 0, y: 20, w: 10, h: 3 },
    ],
  },

  taskMasterPortrait: {
    name: 'Task Master',
    description: 'Tasks and chores stacked vertically for tall screens',
    orientation: 'portrait',
    widgets: [
      { i: 'tasks', x: 0, y: 0, w: 10, h: 7 },
      { i: 'chores', x: 0, y: 7, w: 10, h: 6 },
      { i: 'clock', x: 0, y: 13, w: 5, h: 3 },
      { i: 'weather', x: 5, y: 13, w: 5, h: 3 },
      { i: 'shopping', x: 0, y: 16, w: 10, h: 4 },
      { i: 'calendar', x: 0, y: 20, w: 10, h: 4 },
    ],
  },

  calendarFocusPortrait: {
    name: 'Calendar Focus',
    description: 'Tall calendar dominates the screen',
    orientation: 'portrait',
    widgets: [
      { i: 'clock', x: 0, y: 0, w: 5, h: 3 },
      { i: 'weather', x: 5, y: 0, w: 5, h: 3 },
      { i: 'calendar', x: 0, y: 3, w: 10, h: 10 },
      { i: 'tasks', x: 0, y: 13, w: 10, h: 5 },
      { i: 'birthdays', x: 0, y: 18, w: 5, h: 4 },
      { i: 'messages', x: 5, y: 18, w: 5, h: 4 },
    ],
  },

  commandCenterPortrait: {
    name: 'Command Center',
    description: 'All widgets in a narrow, tall vertical grid',
    orientation: 'portrait',
    widgets: [
      { i: 'clock', x: 0, y: 0, w: 5, h: 3 },
      { i: 'weather', x: 5, y: 0, w: 5, h: 3 },
      { i: 'calendar', x: 0, y: 3, w: 10, h: 5 },
      { i: 'tasks', x: 0, y: 8, w: 5, h: 5 },
      { i: 'messages', x: 5, y: 8, w: 5, h: 5 },
      { i: 'chores', x: 0, y: 13, w: 5, h: 4 },
      { i: 'shopping', x: 5, y: 13, w: 5, h: 4 },
      { i: 'meals', x: 0, y: 17, w: 10, h: 4 },
      { i: 'birthdays', x: 0, y: 21, w: 10, h: 3 },
    ],
  },

  minimalPortrait: {
    name: 'Minimal',
    description: 'Clock, weather, and a tall calendar',
    orientation: 'portrait',
    widgets: [
      { i: 'clock', x: 0, y: 0, w: 5, h: 4 },
      { i: 'weather', x: 5, y: 0, w: 5, h: 4 },
      { i: 'calendar', x: 0, y: 4, w: 10, h: 12 },
      { i: 'tasks', x: 0, y: 16, w: 10, h: 5 },
    ],
  },

  mealPlannerPortrait: {
    name: 'Meal Planner',
    description: 'Meals and shopping stacked for a tall screen',
    orientation: 'portrait',
    widgets: [
      { i: 'meals', x: 0, y: 0, w: 10, h: 7 },
      { i: 'shopping', x: 0, y: 7, w: 10, h: 6 },
      { i: 'clock', x: 0, y: 13, w: 5, h: 3 },
      { i: 'weather', x: 5, y: 13, w: 5, h: 3 },
      { i: 'calendar', x: 0, y: 16, w: 5, h: 6 },
      { i: 'tasks', x: 5, y: 16, w: 5, h: 6 },
    ],
  },
};

export const DEFAULT_TEMPLATE: LayoutTemplate = LAYOUT_TEMPLATES.familyCentral!;
