import type { WidgetConfig } from '@/lib/hooks/useLayouts';

export interface ScreensaverTemplate {
  name: string;
  description: string;
  orientation: 'landscape' | 'portrait';
  widgets: WidgetConfig[];
}

// Screensavers: the PHOTO wallpaper is the hero. Widgets are calm accents that
// float on it.
//   • Where a board has content, CALENDAR (or meals) is the hero WIDGET — big.
//   • Clock, weather, messages are small ACCENTS — never big blocks.
//   • Aligned like the dashboards: stacked accents share a width; a hero + its
//     accent column share top/bottom rows. No ragged, mismatched edges.
//   • One clean rectangular photo region, not scattered gutters. 2–4 widgets.
// Canvas: landscape 48×27, portrait 36×64.

export const SCREENSAVER_TEMPLATES: Record<string, ScreensaverTemplate> = {
  // ── Landscape ────────────────────────────────────────────────────
  minimal: {
    name: 'Minimal',
    description: 'A small clock + weather accent in the corner — the photo is everything else.',
    orientation: 'landscape',
    widgets: [
      { i: 'clock', x: 4, y: 4, w: 15, h: 6, visible: true },     // accent
      { i: 'weather', x: 4, y: 11, w: 15, h: 6, visible: true },  // accent, aligned width
    ],
  },
  photoFrame: {
    name: 'Photo Frame',
    description: 'A tiny clock + weather in the corner — photos fill the screen.',
    orientation: 'landscape',
    widgets: [
      { i: 'clock', x: 34, y: 3, w: 12, h: 5, visible: true },
      { i: 'weather', x: 34, y: 9, w: 12, h: 5, visible: true },
    ],
  },
  infoPanel: {
    name: 'Info Panel',
    description: 'A big upcoming-calendar hero, with a small clock + weather accent column.',
    orientation: 'landscape',
    widgets: [
      { i: 'calendar', x: 2, y: 3, w: 30, h: 21, visible: true }, // HERO
      { i: 'clock', x: 34, y: 3, w: 12, h: 6, visible: true },    // accents (top-aligned with hero)
      { i: 'weather', x: 34, y: 10, w: 12, h: 6, visible: true },
    ],
  },
  familyBoard: {
    name: 'Family Board',
    description: 'A calendar hero, a tall upcoming-events accent, and a small clock.',
    orientation: 'landscape',
    widgets: [
      { i: 'calendar', x: 2, y: 3, w: 24, h: 21, visible: true }, // HERO
      { i: 'birthdays', x: 28, y: 3, w: 13, h: 15, visible: true }, // tall accent
      { i: 'clock', x: 28, y: 19, w: 13, h: 5, visible: true },     // accent (bottom-aligned with hero)
    ],
  },
  kitchen: {
    name: 'Kitchen Display',
    description: 'Tonight’s meals as the hero, with a small clock + weather accent column.',
    orientation: 'landscape',
    widgets: [
      { i: 'meals', x: 2, y: 3, w: 30, h: 21, visible: true },    // HERO
      { i: 'clock', x: 34, y: 3, w: 12, h: 6, visible: true },
      { i: 'weather', x: 34, y: 10, w: 12, h: 6, visible: true },
    ],
  },
  commandCenter: {
    name: 'Command Center',
    description: 'A calendar hero with a small clock / weather / messages accent column.',
    orientation: 'landscape',
    widgets: [
      { i: 'calendar', x: 2, y: 3, w: 26, h: 21, visible: true }, // HERO
      { i: 'clock', x: 30, y: 3, w: 16, h: 6, visible: true },    // accents, aligned width, stacked
      { i: 'weather', x: 30, y: 10, w: 16, h: 6, visible: true },
      { i: 'messages', x: 30, y: 17, w: 16, h: 7, visible: true }, // column bottom aligns with hero
    ],
  },

  // ── Portrait ─────────────────────────────────────────────────────
  minimalPortrait: {
    name: 'Minimal',
    description: 'A small clock + weather accent; the photo owns the screen.',
    orientation: 'portrait',
    widgets: [
      { i: 'clock', x: 4, y: 28, w: 18, h: 7, visible: true },
      { i: 'weather', x: 4, y: 36, w: 18, h: 6, visible: true },
    ],
  },
  photoFramePortrait: {
    name: 'Photo Frame',
    description: 'A tiny clock + weather along the bottom — mostly photo.',
    orientation: 'portrait',
    widgets: [
      { i: 'clock', x: 2, y: 54, w: 16, h: 6, visible: true },
      { i: 'weather', x: 19, y: 54, w: 15, h: 6, visible: true }, // aligned accent row
    ],
  },
  infoPanelPortrait: {
    name: 'Info Panel',
    description: 'A small clock + weather accent row over a big upcoming-calendar hero.',
    orientation: 'portrait',
    widgets: [
      { i: 'clock', x: 2, y: 3, w: 16, h: 7, visible: true },     // accent row (aligned)
      { i: 'weather', x: 19, y: 3, w: 15, h: 7, visible: true },
      { i: 'calendar', x: 2, y: 13, w: 32, h: 30, visible: true }, // HERO
    ],
  },
  familyBoardPortrait: {
    name: 'Family Board',
    description: 'A calendar hero, a tall upcoming-events spine, and a small clock.',
    orientation: 'portrait',
    widgets: [
      { i: 'calendar', x: 2, y: 3, w: 32, h: 26, visible: true }, // HERO
      { i: 'birthdays', x: 2, y: 31, w: 15, h: 30, visible: true }, // tall accent spine
      { i: 'clock', x: 18, y: 31, w: 16, h: 7, visible: true },     // accent
    ],
  },
  kitchenPortrait: {
    name: 'Kitchen Display',
    description: 'A small clock + weather accent row over a big meals hero.',
    orientation: 'portrait',
    widgets: [
      { i: 'clock', x: 2, y: 3, w: 16, h: 7, visible: true },
      { i: 'weather', x: 19, y: 3, w: 15, h: 7, visible: true },
      { i: 'meals', x: 2, y: 13, w: 32, h: 32, visible: true },   // HERO
    ],
  },
  commandCenterPortrait: {
    name: 'Command Center',
    description: 'A clock + weather accent row, a big calendar hero, and a low messages accent.',
    orientation: 'portrait',
    widgets: [
      { i: 'clock', x: 2, y: 3, w: 16, h: 7, visible: true },
      { i: 'weather', x: 19, y: 3, w: 15, h: 7, visible: true },
      { i: 'calendar', x: 2, y: 13, w: 32, h: 28, visible: true }, // HERO
      { i: 'messages', x: 2, y: 43, w: 32, h: 7, visible: true },  // accent
    ],
  },
};
