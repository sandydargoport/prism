import type { WidgetConfig } from '@/lib/hooks/useLayouts';

export interface LayoutTemplate {
  name: string;
  description: string;
  orientation: 'landscape' | 'portrait';
  widgets: WidgetConfig[];
}

// Grid: 48 columns (each cell ~20-25px on 1080p)
// Widget sizes are relative to this grid

export const LAYOUT_TEMPLATES: Record<string, LayoutTemplate> = {
  // ── Landscape Templates ──────────────────────────────────────────
  familyCentral: {
    name: 'Family Central',
    description: 'Balanced layout with calendar, tasks, and family features',
    orientation: 'landscape',
    widgets: [
      { i: 'calendar', x: 0, y: 0, w: 28, h: 48 },
      { i: 'clock', x: 28, y: 0, w: 20, h: 16 },
      { i: 'weather', x: 28, y: 16, w: 20, h: 16 },
      { i: 'tasks', x: 28, y: 32, w: 20, h: 32 },
      { i: 'messages', x: 0, y: 48, w: 16, h: 32 },
      { i: 'chores', x: 16, y: 48, w: 16, h: 32 },
      { i: 'birthdays', x: 32, y: 64, w: 16, h: 16 },
    ],
  },

  taskMaster: {
    name: 'Task Master',
    description: 'Tasks and chores front and center',
    orientation: 'landscape',
    widgets: [
      { i: 'tasks', x: 0, y: 0, w: 24, h: 48 },
      { i: 'chores', x: 24, y: 0, w: 24, h: 48 },
      { i: 'clock', x: 0, y: 48, w: 12, h: 16 },
      { i: 'weather', x: 12, y: 48, w: 12, h: 16 },
      { i: 'calendar', x: 24, y: 48, w: 24, h: 32 },
      { i: 'shopping', x: 0, y: 64, w: 24, h: 16 },
    ],
  },

  calendarFocus: {
    name: 'Calendar Focus',
    description: 'Large calendar with compact info sidebar',
    orientation: 'landscape',
    widgets: [
      { i: 'calendar', x: 0, y: 0, w: 36, h: 64 },
      { i: 'clock', x: 36, y: 0, w: 12, h: 16 },
      { i: 'weather', x: 36, y: 16, w: 12, h: 16 },
      { i: 'tasks', x: 36, y: 32, w: 12, h: 24 },
      { i: 'birthdays', x: 36, y: 56, w: 12, h: 16 },
      { i: 'messages', x: 0, y: 64, w: 24, h: 16 },
    ],
  },

  commandCenter: {
    name: 'Command Center',
    description: 'Everything visible at a glance',
    orientation: 'landscape',
    widgets: [
      { i: 'clock', x: 0, y: 0, w: 16, h: 16 },
      { i: 'weather', x: 16, y: 0, w: 16, h: 16 },
      { i: 'birthdays', x: 32, y: 0, w: 16, h: 16 },
      { i: 'calendar', x: 0, y: 16, w: 24, h: 32 },
      { i: 'tasks', x: 24, y: 16, w: 24, h: 32 },
      { i: 'chores', x: 0, y: 48, w: 16, h: 24 },
      { i: 'shopping', x: 16, y: 48, w: 16, h: 24 },
      { i: 'messages', x: 32, y: 48, w: 16, h: 24 },
      { i: 'meals', x: 0, y: 72, w: 48, h: 16 },
    ],
  },

  minimal: {
    name: 'Minimal',
    description: 'Clean and simple - just the essentials',
    orientation: 'landscape',
    widgets: [
      { i: 'clock', x: 0, y: 0, w: 24, h: 24 },
      { i: 'weather', x: 24, y: 0, w: 24, h: 24 },
      { i: 'calendar', x: 0, y: 24, w: 32, h: 40 },
      { i: 'tasks', x: 32, y: 24, w: 16, h: 40 },
    ],
  },

  mealPlanner: {
    name: 'Meal Planner',
    description: 'Focus on meals and shopping',
    orientation: 'landscape',
    widgets: [
      { i: 'meals', x: 0, y: 0, w: 32, h: 40 },
      { i: 'clock', x: 32, y: 0, w: 16, h: 16 },
      { i: 'weather', x: 32, y: 16, w: 16, h: 12 },
      { i: 'calendar', x: 32, y: 28, w: 16, h: 24 },
      { i: 'shopping', x: 0, y: 40, w: 24, h: 32 },
      { i: 'tasks', x: 24, y: 40, w: 24, h: 32 },
    ],
  },

  // ── Portrait Templates ───────────────────────────────────────────
  familyCentralPortrait: {
    name: 'Family Central',
    description: 'Vertically stacked with calendar as the centerpiece',
    orientation: 'portrait',
    widgets: [
      { i: 'clock', x: 0, y: 0, w: 20, h: 12 },
      { i: 'weather', x: 20, y: 0, w: 20, h: 12 },
      { i: 'calendar', x: 0, y: 12, w: 40, h: 32 },
      { i: 'tasks', x: 0, y: 44, w: 20, h: 20 },
      { i: 'chores', x: 20, y: 44, w: 20, h: 20 },
      { i: 'messages', x: 0, y: 64, w: 40, h: 16 },
      { i: 'birthdays', x: 0, y: 80, w: 40, h: 12 },
    ],
  },

  taskMasterPortrait: {
    name: 'Task Master',
    description: 'Tasks and chores stacked vertically for tall screens',
    orientation: 'portrait',
    widgets: [
      { i: 'tasks', x: 0, y: 0, w: 40, h: 28 },
      { i: 'chores', x: 0, y: 28, w: 40, h: 24 },
      { i: 'clock', x: 0, y: 52, w: 20, h: 12 },
      { i: 'weather', x: 20, y: 52, w: 20, h: 12 },
      { i: 'shopping', x: 0, y: 64, w: 40, h: 16 },
      { i: 'calendar', x: 0, y: 80, w: 40, h: 16 },
    ],
  },

  calendarFocusPortrait: {
    name: 'Calendar Focus',
    description: 'Tall calendar dominates the screen',
    orientation: 'portrait',
    widgets: [
      { i: 'clock', x: 0, y: 0, w: 20, h: 12 },
      { i: 'weather', x: 20, y: 0, w: 20, h: 12 },
      { i: 'calendar', x: 0, y: 12, w: 40, h: 40 },
      { i: 'tasks', x: 0, y: 52, w: 40, h: 20 },
      { i: 'birthdays', x: 0, y: 72, w: 20, h: 16 },
      { i: 'messages', x: 20, y: 72, w: 20, h: 16 },
    ],
  },

  commandCenterPortrait: {
    name: 'Command Center',
    description: 'All widgets in a narrow, tall vertical grid',
    orientation: 'portrait',
    widgets: [
      { i: 'clock', x: 0, y: 0, w: 20, h: 12 },
      { i: 'weather', x: 20, y: 0, w: 20, h: 12 },
      { i: 'calendar', x: 0, y: 12, w: 40, h: 20 },
      { i: 'tasks', x: 0, y: 32, w: 20, h: 20 },
      { i: 'messages', x: 20, y: 32, w: 20, h: 20 },
      { i: 'chores', x: 0, y: 52, w: 20, h: 16 },
      { i: 'shopping', x: 20, y: 52, w: 20, h: 16 },
      { i: 'meals', x: 0, y: 68, w: 40, h: 16 },
      { i: 'birthdays', x: 0, y: 84, w: 40, h: 12 },
    ],
  },

  minimalPortrait: {
    name: 'Minimal',
    description: 'Clock, weather, and a tall calendar',
    orientation: 'portrait',
    widgets: [
      { i: 'clock', x: 0, y: 0, w: 20, h: 16 },
      { i: 'weather', x: 20, y: 0, w: 20, h: 16 },
      { i: 'calendar', x: 0, y: 16, w: 40, h: 48 },
      { i: 'tasks', x: 0, y: 64, w: 40, h: 20 },
    ],
  },

  mealPlannerPortrait: {
    name: 'Meal Planner',
    description: 'Meals and shopping stacked for a tall screen',
    orientation: 'portrait',
    widgets: [
      { i: 'meals', x: 0, y: 0, w: 40, h: 28 },
      { i: 'shopping', x: 0, y: 28, w: 40, h: 24 },
      { i: 'clock', x: 0, y: 52, w: 20, h: 12 },
      { i: 'weather', x: 20, y: 52, w: 20, h: 12 },
      { i: 'calendar', x: 0, y: 64, w: 20, h: 24 },
      { i: 'tasks', x: 20, y: 64, w: 20, h: 24 },
    ],
  },
};

// Fallback layout used when the /api/layouts response is in-flight or empty.
// Matches the seeded "Default Dashboard" so the brief loading flash isn't a
// disorienting layout swap — and so docs screenshots captured during that
// window still look correct. Keep these widgets in sync with seed.ts.
//
// Trimmed to 6 widgets (Meals removed) — a fresh install's default dashboard
// was overrunning the screen with too many widgets. This is the DEFAULT for
// new installs only; existing users' saved layouts (a real row in the
// `layouts` table) are unaffected — this fallback is only used before any
// layout has been saved.
export const DEFAULT_TEMPLATE: LayoutTemplate = {
  name: 'Default',
  description: 'One-screen 5-widget layout — weather-forward, no calendar/birthdays/points',
  orientation: 'landscape',
  widgets: [
    { i: 'weather',  x: 0,  y: 0,  w: 24, h: 24 },
    { i: 'clock',    x: 24, y: 0,  w: 24, h: 6  },
    { i: 'tasks',    x: 24, y: 6,  w: 24, h: 6  },
    { i: 'chores',   x: 24, y: 12, w: 24, h: 6  },
    { i: 'shopping', x: 24, y: 18, w: 24, h: 6  },
  ],
};
