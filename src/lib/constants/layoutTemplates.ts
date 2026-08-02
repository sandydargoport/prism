import type { WidgetConfig } from '@/lib/hooks/useLayouts';

export interface LayoutTemplate {
  name: string;
  description: string;
  orientation: 'landscape' | 'portrait';
  widgets: WidgetConfig[];
}

// Canonical design canvases (match the editor screen guides in
// useScreenSafeZones): landscape = 48 cols × 27 rows (16:9), portrait =
// 36 cols × 64 rows (9:16). Every template's widgets tile that whole canvas
// exactly, so on the live dashboard (which stretches the content to fill the
// screen) they fill edge-to-edge with no overflow and no aspect skew.

export const LAYOUT_TEMPLATES: Record<string, LayoutTemplate> = {
  // ── Landscape Templates (48 × 27) ────────────────────────────────
  familyCentral: {
    name: 'Family Central',
    description: 'Balanced layout with calendar, tasks, and family features',
    orientation: 'landscape',
    widgets: [
      { i: 'calendar', x: 0, y: 0, w: 28, h: 18 },
      { i: 'clock', x: 28, y: 0, w: 20, h: 6 },
      { i: 'weather', x: 28, y: 6, w: 20, h: 12 },
      { i: 'tasks', x: 0, y: 18, w: 12, h: 9 },
      { i: 'messages', x: 12, y: 18, w: 12, h: 9 },
      { i: 'chores', x: 24, y: 18, w: 12, h: 9 },
      { i: 'birthdays', x: 36, y: 18, w: 12, h: 9 },
    ],
  },

  taskMaster: {
    name: 'Task Master',
    description: 'Tasks and chores front and center',
    orientation: 'landscape',
    widgets: [
      { i: 'tasks', x: 0, y: 0, w: 24, h: 16 },
      { i: 'chores', x: 24, y: 0, w: 24, h: 16 },
      { i: 'clock', x: 0, y: 16, w: 12, h: 11 },
      { i: 'weather', x: 12, y: 16, w: 12, h: 11 },
      { i: 'calendar', x: 24, y: 16, w: 12, h: 11 },
      { i: 'shopping', x: 36, y: 16, w: 12, h: 11 },
    ],
  },

  calendarFocus: {
    name: 'Calendar Focus',
    description: 'Large calendar with compact info sidebar',
    orientation: 'landscape',
    widgets: [
      { i: 'calendar', x: 0, y: 0, w: 34, h: 27 },
      { i: 'clock', x: 34, y: 0, w: 14, h: 4 },
      { i: 'weather', x: 34, y: 4, w: 14, h: 11 },
      { i: 'tasks', x: 34, y: 15, w: 14, h: 7 },
      { i: 'birthdays', x: 34, y: 22, w: 14, h: 5 },
    ],
  },

  commandCenter: {
    name: 'Command Center',
    description: 'Everything visible at a glance',
    orientation: 'landscape',
    widgets: [
      { i: 'clock', x: 0, y: 0, w: 16, h: 6 },
      { i: 'weather', x: 16, y: 0, w: 16, h: 6 },
      { i: 'birthdays', x: 32, y: 0, w: 16, h: 6 },
      { i: 'calendar', x: 0, y: 6, w: 24, h: 10 },
      { i: 'tasks', x: 24, y: 6, w: 24, h: 10 },
      { i: 'chores', x: 0, y: 16, w: 16, h: 5 },
      { i: 'shopping', x: 16, y: 16, w: 16, h: 5 },
      { i: 'messages', x: 32, y: 16, w: 16, h: 5 },
      { i: 'meals', x: 0, y: 21, w: 48, h: 6 },
    ],
  },

  minimal: {
    name: 'Minimal',
    description: 'Clean and simple - just the essentials',
    orientation: 'landscape',
    widgets: [
      { i: 'clock', x: 0, y: 0, w: 24, h: 10 },
      { i: 'weather', x: 24, y: 0, w: 24, h: 10 },
      { i: 'calendar', x: 0, y: 10, w: 32, h: 17 },
      { i: 'tasks', x: 32, y: 10, w: 16, h: 17 },
    ],
  },

  mealPlanner: {
    name: 'Meal Planner',
    description: 'Focus on meals and shopping',
    orientation: 'landscape',
    widgets: [
      { i: 'meals', x: 0, y: 0, w: 32, h: 15 },
      { i: 'shopping', x: 0, y: 15, w: 16, h: 12 },
      { i: 'tasks', x: 16, y: 15, w: 16, h: 12 },
      { i: 'clock', x: 32, y: 0, w: 16, h: 5 },
      { i: 'weather', x: 32, y: 5, w: 16, h: 11 },
      { i: 'calendar', x: 32, y: 16, w: 16, h: 11 },
    ],
  },

  // ── Portrait Templates (36 × 64) ─────────────────────────────────
  familyCentralPortrait: {
    name: 'Family Central',
    description: 'Vertically stacked with calendar as the centerpiece',
    orientation: 'portrait',
    widgets: [
      { i: 'clock', x: 0, y: 0, w: 18, h: 13 },
      { i: 'weather', x: 18, y: 0, w: 18, h: 13 },
      { i: 'calendar', x: 0, y: 13, w: 36, h: 23 },
      { i: 'tasks', x: 0, y: 36, w: 18, h: 14 },
      { i: 'chores', x: 18, y: 36, w: 18, h: 14 },
      { i: 'messages', x: 0, y: 50, w: 36, h: 8 },
      { i: 'birthdays', x: 0, y: 58, w: 36, h: 6 },
    ],
  },

  taskMasterPortrait: {
    name: 'Task Master',
    description: 'Tasks and chores stacked vertically for tall screens',
    orientation: 'portrait',
    widgets: [
      { i: 'tasks', x: 0, y: 0, w: 36, h: 20 },
      { i: 'chores', x: 0, y: 20, w: 36, h: 16 },
      { i: 'clock', x: 0, y: 36, w: 18, h: 13 },
      { i: 'weather', x: 18, y: 36, w: 18, h: 13 },
      { i: 'shopping', x: 0, y: 49, w: 36, h: 7 },
      { i: 'calendar', x: 0, y: 56, w: 36, h: 8 },
    ],
  },

  calendarFocusPortrait: {
    name: 'Calendar Focus',
    description: 'Tall calendar dominates the screen',
    orientation: 'portrait',
    widgets: [
      { i: 'clock', x: 0, y: 0, w: 18, h: 13 },
      { i: 'weather', x: 18, y: 0, w: 18, h: 13 },
      { i: 'calendar', x: 0, y: 13, w: 36, h: 29 },
      { i: 'tasks', x: 0, y: 42, w: 36, h: 12 },
      { i: 'birthdays', x: 0, y: 54, w: 18, h: 10 },
      { i: 'messages', x: 18, y: 54, w: 18, h: 10 },
    ],
  },

  commandCenterPortrait: {
    name: 'Command Center',
    description: 'All widgets in a narrow, tall vertical grid',
    orientation: 'portrait',
    widgets: [
      { i: 'clock', x: 0, y: 0, w: 18, h: 11 },
      { i: 'weather', x: 18, y: 0, w: 18, h: 11 },
      { i: 'calendar', x: 0, y: 11, w: 36, h: 13 },
      { i: 'tasks', x: 0, y: 24, w: 18, h: 12 },
      { i: 'messages', x: 18, y: 24, w: 18, h: 12 },
      { i: 'chores', x: 0, y: 36, w: 18, h: 9 },
      { i: 'shopping', x: 18, y: 36, w: 18, h: 9 },
      { i: 'meals', x: 0, y: 45, w: 36, h: 11 },
      { i: 'birthdays', x: 0, y: 56, w: 36, h: 8 },
    ],
  },

  minimalPortrait: {
    name: 'Minimal',
    description: 'Clock, weather, and a tall calendar',
    orientation: 'portrait',
    widgets: [
      { i: 'clock', x: 0, y: 0, w: 18, h: 14 },
      { i: 'weather', x: 18, y: 0, w: 18, h: 14 },
      { i: 'calendar', x: 0, y: 14, w: 36, h: 34 },
      { i: 'tasks', x: 0, y: 48, w: 36, h: 16 },
    ],
  },

  mealPlannerPortrait: {
    name: 'Meal Planner',
    description: 'Meals and shopping stacked for a tall screen',
    orientation: 'portrait',
    widgets: [
      { i: 'meals', x: 0, y: 0, w: 36, h: 20 },
      { i: 'shopping', x: 0, y: 20, w: 36, h: 16 },
      { i: 'clock', x: 0, y: 36, w: 18, h: 13 },
      { i: 'weather', x: 18, y: 36, w: 18, h: 13 },
      { i: 'calendar', x: 0, y: 49, w: 18, h: 15 },
      { i: 'tasks', x: 18, y: 49, w: 18, h: 15 },
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
