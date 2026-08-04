import type { WidgetConfig } from '@/lib/hooks/useLayouts';

export interface LayoutTemplate {
  name: string;
  description: string;
  orientation: 'landscape' | 'portrait';
  widgets: WidgetConfig[];
}

// Canonical design canvases (match the editor screen guides): landscape =
// 48 cols × 27 rows (16:9), portrait = 36 cols × 64 rows (9:16). On the live
// dashboard the content bounding box is stretched to fill the screen, so a
// template that tiles the whole canvas fills edge-to-edge.
//
// Design brief (see the whole-board composition principles, not just widgets):
//   • One hero per board (usually calendar; photos = the wallpaper, not a
//     widget). Hero ~3–5× the area of a supporting tile.
//   • Widgets sized to their ideal shape: calendar big; birthdays TALL not wide;
//     clock small; weather compact OR big (big = sun/moon); tasks/chores/etc.
//     are tertiary list columns used sparingly.
//   • Composed into 2–3 zones by relationship with asymmetric balance — not an
//     even 4-up grid. Fewer, well-shaped widgets over many cramped ones.
//
// Most templates tile the canvas exactly. The one intentional exception is
// "Ambient", which places a couple of accent widgets and leaves the rest open
// so the photo wallpaper shows through as the hero.

export const LAYOUT_TEMPLATES: Record<string, LayoutTemplate> = {
  // ── Landscape Templates (48 × 27) ────────────────────────────────
  familyCentral: {
    name: 'Family Central',
    description: 'Calendar hero with a tall upcoming-events column and an at-a-glance weather + clock strip.',
    orientation: 'landscape',
    widgets: [
      { i: 'calendar', x: 0, y: 0, w: 33, h: 19 },   // hero (big block)
      { i: 'birthdays', x: 33, y: 0, w: 15, h: 27 },  // "what's ahead" — tall arrivals rail
      { i: 'weather', x: 0, y: 19, w: 24, h: 8 },     // "right now" — wide strip
      { i: 'clock', x: 24, y: 19, w: 9, h: 8 },        // small tile; doesn't rival weather
    ],
  },

  calendarFocus: {
    name: 'Calendar Focus',
    description: 'A full-height calendar with a slim weather + clock rail — for when the schedule is everything.',
    orientation: 'landscape',
    widgets: [
      { i: 'calendar', x: 0, y: 0, w: 34, h: 27 },   // full-height hero (~70%)
      { i: 'weather', x: 34, y: 0, w: 14, h: 16 },    // big weather → sun/moon
      { i: 'clock', x: 34, y: 16, w: 14, h: 11 },
    ],
  },

  commandCenter: {
    name: 'Command Center',
    description: 'Everything at a glance — calendar hero plus weather, clock, and your task, chore, and message lists.',
    orientation: 'landscape',
    widgets: [
      { i: 'calendar', x: 0, y: 0, w: 30, h: 18 },   // hero
      { i: 'clock', x: 30, y: 0, w: 18, h: 5 },       // "now + notes" right column
      { i: 'weather', x: 30, y: 5, w: 18, h: 13 },     // big → sun/moon
      { i: 'messages', x: 30, y: 18, w: 18, h: 9 },     // joins the right column (x=30 seam)
      { i: 'tasks', x: 0, y: 18, w: 15, h: 9 },        // "action" pair under the calendar
      { i: 'chores', x: 15, y: 18, w: 15, h: 9 },
    ],
  },

  mealPlanner: {
    name: 'Meal Planner',
    description: 'Kitchen board — meals front and center with a tall shopping list and a weather + clock corner.',
    orientation: 'landscape',
    widgets: [
      { i: 'meals', x: 0, y: 0, w: 32, h: 18 },       // hero
      { i: 'shopping', x: 32, y: 0, w: 16, h: 27 },    // tall list column
      { i: 'weather', x: 0, y: 18, w: 20, h: 9 },
      { i: 'clock', x: 20, y: 18, w: 12, h: 9 },
    ],
  },

  schoolMornings: {
    name: 'School Mornings',
    description: 'Out-the-door board — calendar, a bus departure countdown, weather, homework tasks, and the lunch menu.',
    orientation: 'landscape',
    widgets: [
      { i: 'calendar', x: 0, y: 0, w: 28, h: 18 },    // hero (color-code per kid)
      { i: 'busTracking', x: 28, y: 0, w: 20, h: 8 },  // departure countdown (1 row shorter)
      { i: 'weather', x: 28, y: 8, w: 20, h: 10 },     // dress for the day (roomier for forecast)
      { i: 'tasks', x: 0, y: 18, w: 24, h: 9 },        // homework / permission slips
      { i: 'meals', x: 24, y: 18, w: 24, h: 9 },       // lunch
    ],
  },

  ambient: {
    name: 'Ambient',
    description: 'Photo-forward — your wallpaper takes the screen, with glassy floating clock and weather accents. Pair with a photo wallpaper.',
    orientation: 'landscape',
    // Intentionally sparse: two frosted-glass accents in opposite corners; the
    // open center is the wallpaper photo (the hero). Asymmetric, calm.
    widgets: [
      { i: 'clock', x: 0, y: 0, w: 14, h: 8, backgroundColor: 'frosted' },
      { i: 'weather', x: 30, y: 14, w: 18, h: 13, backgroundColor: 'frosted' }, // big → sun/moon (h≥12 shows arc)
    ],
  },

  // ── Portrait Templates (36 × 64) ─────────────────────────────────
  familyCentralPortrait: {
    name: 'Family Central',
    description: 'Calendar hero with weather + clock bands above and a tall upcoming-events list below.',
    orientation: 'portrait',
    widgets: [
      { i: 'clock', x: 0, y: 0, w: 36, h: 8 },        // ambient header banner
      { i: 'calendar', x: 0, y: 8, w: 36, h: 30 },     // hero at eye level
      { i: 'weather', x: 0, y: 38, w: 20, h: 26 },     // big → sun/moon (a feature, not a strip)
      { i: 'birthdays', x: 20, y: 38, w: 16, h: 26 },  // genuinely tall column (not short-wide)
    ],
  },

  calendarFocusPortrait: {
    name: 'Calendar Focus',
    description: 'A towering calendar with small weather + clock bands — the schedule dominates.',
    orientation: 'portrait',
    widgets: [
      { i: 'calendar', x: 0, y: 0, w: 36, h: 48 },     // dominant hero (~75%)
      { i: 'weather', x: 0, y: 48, w: 36, h: 9 },
      { i: 'clock', x: 0, y: 57, w: 36, h: 7 },
    ],
  },

  commandCenterPortrait: {
    name: 'Command Center',
    description: 'Everything at a glance — weather/clock, a calendar hero, task and chore columns, and messages.',
    orientation: 'portrait',
    widgets: [
      { i: 'clock', x: 0, y: 0, w: 13, h: 7 },        // asymmetric "now" strip
      { i: 'weather', x: 13, y: 0, w: 23, h: 7 },
      { i: 'calendar', x: 0, y: 7, w: 36, h: 29 },     // hero
      { i: 'tasks', x: 0, y: 36, w: 18, h: 28 },       // primary list earns full depth
      { i: 'chores', x: 18, y: 36, w: 18, h: 14 },
      { i: 'messages', x: 18, y: 50, w: 18, h: 14 },   // note block, right-sized (not rivaling hero)
    ],
  },

  mealPlannerPortrait: {
    name: 'Meal Planner',
    description: 'Kitchen board — a weather/clock strip over a meals hero and a tall shopping list.',
    orientation: 'portrait',
    widgets: [
      { i: 'clock', x: 0, y: 0, w: 20, h: 7 },
      { i: 'weather', x: 20, y: 0, w: 16, h: 7 },
      { i: 'meals', x: 0, y: 7, w: 36, h: 26 },        // hero
      { i: 'shopping', x: 0, y: 33, w: 36, h: 31 },    // tall list
    ],
  },

  schoolMorningsPortrait: {
    name: 'School Mornings',
    description: 'Out-the-door board — bus countdown up top, weather, a calendar hero, and the lunch menu.',
    orientation: 'portrait',
    widgets: [
      { i: 'busTracking', x: 0, y: 0, w: 36, h: 10 },  // departure countdown (1 row shorter)
      { i: 'weather', x: 0, y: 10, w: 36, h: 10 },      // roomier for the forecast
      { i: 'calendar', x: 0, y: 20, w: 36, h: 28 },     // hero
      { i: 'meals', x: 0, y: 48, w: 36, h: 16 },        // lunch
    ],
  },

  ambientPortrait: {
    name: 'Ambient',
    description: 'Photo-forward — your wallpaper takes the screen, with glassy clock and weather accents top and bottom.',
    orientation: 'portrait',
    // Sparse frosted-glass bands top and bottom; the open middle is the photo.
    widgets: [
      { i: 'clock', x: 0, y: 0, w: 36, h: 9, backgroundColor: 'frosted' },
      { i: 'weather', x: 0, y: 51, w: 36, h: 13, backgroundColor: 'frosted' },
    ],
  },
};

// New-user / empty-layout fallback. Deliberately weather-forward with NO
// calendar/birthdays/points — a fresh install hasn't connected a calendar yet,
// so a calendar-hero default would render empty. Not shown in the template
// picker; it's the safety-net layout applied when a dashboard has no widgets.
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
