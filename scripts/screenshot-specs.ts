/**
 * What scripts/capture-screenshots.ts shoots. Kept apart from the capture
 * script, which launches a browser the moment it loads, so jest can read the
 * list (src/lib/__tests__/screenshotGallery.test.ts).
 *
 * Three groups:
 * - the hero: one moment on a wall, a tablet and a phone, framed together;
 * - the gallery (docs/screenshots.md): what a family sees and uses, staged in
 *   the new install's looks, never an admin or editing screen;
 * - feature shots: one page each, for the feature docs.
 */

import type { Page } from '@playwright/test';
import { LOOK_IDS, LOOKS, type LookId } from '../src/lib/looks';

/**
 * Touch-screen devices for the hero and gallery shots. Pointer type has to be
 * set when the browser launches (Blink bitmask: coarse = 2); emulating it per
 * page is silently ignored. A coarse pointer is what makes Prism size itself
 * for a wall: the 20px root and the 14px text floor.
 */
export const DEVICES = {
  wall: { viewport: { width: 1920, height: 1080 }, scale: 1, isMobile: false },
  tablet: { viewport: { width: 1180, height: 820 }, scale: 1, isMobile: false },
  phone: { viewport: { width: 390, height: 844 }, scale: 2, isMobile: true },
} as const;
export type DeviceName = keyof typeof DEVICES;

export type CalendarViewType =
  | 'agenda'
  | 'day'
  | 'week'
  | 'weekVertical'
  | 'multiWeek'
  | 'month'
  | 'threeMonth';

/** Dashboard widgets the staged layouts place, and so the ones a close-up can take. */
export type StagedWidget = 'clock' | 'calendar' | 'weather' | 'birthdays' | 'chores' | 'shopping';

/** One widget's cell on the 48x27 dashboard grid. */
type StagedCell = { i: StagedWidget; x: number; y: number; w: number; h: number; showWhenIdle: boolean };

/**
 * A new install's look (src/lib/looks.ts) on one of the staged dashboards.
 * The capture script applies it before the shot and puts everything back after.
 */
export type Stage = {
  look: LookId;
  layout: 'hero' | 'gallery';
};

export type CaptureSpec = {
  name: string;
  url: string;
  description: string;
  /** Wait extra ms after navigation (for animations / lazy-load) */
  settleMs?: number;
  /** Set the theme before capture: 'light' | 'dark' (default light) */
  theme?: 'light' | 'dark';
  /** Mobile viewport instead of desktop */
  mobile?: boolean;
  /**
   * Pre-seed the calendar view via localStorage before navigation. The view
   * picker (ViewMenu) reads `prism-calendar-view-type` and `prism-calendar-
   * week-count` on mount, so this is the most reliable way to land on a
   * specific view: no need to click through the popover.
   */
  calendarView?: CalendarViewType;
  calendarWeekCount?: 1 | 2 | 3 | 4;
  /**
   * Pre-seed the calendar display mode (inline strips vs stacked cards).
   * Reads `prism-calendar-display-mode` localStorage on mount.
   */
  calendarDisplayMode?: 'inline' | 'cards';
  /** Optional pre-screenshot setup (e.g. click into a sub-view) */
  setup?: (page: Page) => Promise<void>;
  /** A touch-screen device from DEVICES, instead of the desktop or mobile viewport. */
  device?: DeviceName;
  /** Capture signed out, the way a wall display runs. */
  signedOut?: boolean;
  /**
   * Leave the screen untouched long enough for auto-hide to take the side
   * rail and top bar away, as a wall shows them when nobody is using it.
   */
  idleChrome?: boolean;
  /**
   * Put the dashboard into its idle screen before the shot: the widgets that
   * do not stay when idle fade, leaving the photo with the clock and weather.
   */
  idle?: boolean;
  /** Shoot in this look on this staged dashboard. Staged shots run before any demo photos exist. */
  stage?: Stage;
  /** Shoot only this dashboard widget, close up, instead of the whole screen. */
  widget?: StagedWidget;
  /** Shown in the docs gallery (docs/screenshots.md). */
  gallery?: boolean;
};

/**
 * The hero's dashboard, on the 48x27 grid. The clock and weather are small
 * tiles in the two top corners with the photo between them (#905), the
 * calendar below on the left and birthdays on the right. Clock and weather
 * stay when idle, so the tablet's idle shot is the photo with the time and
 * weather on its top corners.
 */
export const HERO_LAYOUT = [
  { i: 'clock', x: 0, y: 0, w: 12, h: 5, showWhenIdle: true },
  { i: 'calendar', x: 0, y: 5, w: 30, h: 22, showWhenIdle: false },
  { i: 'weather', x: 36, y: 0, w: 12, h: 5, showWhenIdle: true },
  { i: 'birthdays', x: 30, y: 5, w: 18, h: 12, showWhenIdle: false },
] satisfies StagedCell[];

/**
 * The gallery's dashboard: the hero's corner clock and weather and its
 * calendar, with the two lists a family touches every day, chores and
 * shopping, on the right. Clock and weather stay when idle.
 */
export const GALLERY_LAYOUT = [
  { i: 'clock', x: 0, y: 0, w: 12, h: 5, showWhenIdle: true },
  { i: 'calendar', x: 0, y: 5, w: 30, h: 22, showWhenIdle: false },
  { i: 'weather', x: 36, y: 0, w: 12, h: 5, showWhenIdle: true },
  { i: 'chores', x: 30, y: 5, w: 18, h: 12, showWhenIdle: false },
  { i: 'shopping', x: 30, y: 17, w: 18, h: 10, showWhenIdle: false },
] satisfies StagedCell[];

export const STAGE_LAYOUTS = { hero: HERO_LAYOUT, gallery: GALLERY_LAYOUT } as const;

/**
 * The hero set: the same moment on a wall, a tablet and a phone, in light and
 * dark. frame-screenshots.ts puts each trio into device frames afterwards.
 * Each device shows a different side of it: the wall the dashboard, the
 * tablet the idle screen (the photo with the clock and weather), the phone
 * the mobile home. The wall and the tablet are signed out, as they would be
 * in a kitchen; the phone is a parent's, signed in. They show a new install
 * in the Photo look.
 */
export const HERO_SHOTS: CaptureSpec[] = (['light', 'dark'] as const).flatMap((theme) => {
  const stage: Stage = { look: 'photo', layout: 'hero' };
  return [
    {
      name: `hero-wall-${theme}`,
      url: '/',
      description: `Wall display, 1080p touch, signed out (${theme})`,
      theme,
      device: 'wall' as const,
      signedOut: true,
      idleChrome: true,
      stage,
      settleMs: 15000,
    },
    {
      name: `hero-tablet-${theme}`,
      url: '/',
      description: `Tablet, touch, signed out, idle screen (${theme})`,
      theme,
      device: 'tablet' as const,
      signedOut: true,
      idleChrome: true,
      idle: true,
      stage,
      settleMs: 15000,
    },
    {
      name: `hero-phone-${theme}`,
      url: '/',
      description: `Phone, signed in (${theme})`,
      theme,
      device: 'phone' as const,
      stage,
      settleMs: 15000,
    },
  ];
});

const LOOK_NAMES: Record<LookId, string> = { photo: 'Photo', night: 'Night', paper: 'Paper' };

/** A signed-out wall on the gallery dashboard, rail and bar hidden. */
const wall = (look: LookId) => ({
  url: '/',
  device: 'wall' as const,
  signedOut: true,
  idleChrome: true,
  stage: { look, layout: 'gallery' as const },
  gallery: true,
  settleMs: 15000,
});

/** A parent's phone, signed in, in the Photo look. */
const phone = (url: string) => ({
  url,
  device: 'phone' as const,
  stage: { look: 'photo' as const, layout: 'gallery' as const },
  gallery: true,
  settleMs: 8000,
});

/**
 * The gallery: what a family sees. The wall in each look a new install
 * offers, its idle screen, the widgets they use close up, and a parent's
 * phone. Admin and editing screens stay out; the feature docs show those.
 */
export const GALLERY_SHOTS: CaptureSpec[] = [
  ...LOOK_IDS.map((look) => ({
    name: `look-${look}`,
    description: `The wall in the ${LOOK_NAMES[look]} look`,
    ...wall(look),
  })),
  {
    name: 'idle-screen',
    description: 'The wall when nobody is using it: the photo, the clock and the weather',
    ...wall('photo'),
    idle: true,
  },
  ...(['calendar', 'chores', 'shopping'] as const).map((widget) => ({
    name: `widget-${widget}`,
    description: `The wall's ${widget} widget, close up`,
    ...wall('photo'),
    widget,
  })),
  { name: 'phone-home', description: 'Phone home screen, signed in', ...phone('/') },
  { name: 'phone-calendar', description: 'Phone calendar', ...phone('/calendar'), calendarView: 'agenda' },
  { name: 'phone-shopping', description: 'Phone shopping list', ...phone('/shopping') },
];

/**
 * Switch a list page (Tasks, Wishes) into group-by-person view via its "Group"
 * filter dropdown, so the screenshot shows per-member columns. Best-effort: if
 * the control isn't found the page is left in its default flat view.
 */
async function groupByPerson(page: Page): Promise<void> {
  try {
    // The FilterDropdown trigger's accessible name is its label ("Group").
    await page.getByRole('button', { name: /^Group/ }).first().click({ timeout: 6000 });
    // Options render as Radix menuitemcheckbox rows labelled "None" / "Person".
    await page.getByRole('menuitemcheckbox', { name: /^Person$/ }).first().click({ timeout: 3000 });
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(1000);
  } catch {
    // Leave the page in its default view.
  }
}

/** One page each, for the feature docs (docs/features/*.md). */
export const FEATURE_SHOTS: CaptureSpec[] = [
  // ─── Dashboard ─────────────────────────────────────────────
  {
    name: 'dashboard-mobile',
    url: '/',
    description: 'Mobile dashboard (single-column cards)',
    mobile: true,
    settleMs: 15000, // mobile cards each fetch async
  },

  // ─── Calendar ──────────────────────────────────────────────
  // Each view is pre-seeded via localStorage rather than clicking the view
  // picker; see CaptureSpec.calendarView above for the rationale.
  {
    name: 'calendar-month',
    url: '/calendar',
    description: 'Calendar month view',
    settleMs: 6000,
    calendarView: 'month',
  },
  {
    name: 'calendar-multiweek',
    url: '/calendar',
    description: 'Calendar multi-week view (2 weeks)',
    settleMs: 6000,
    calendarView: 'multiWeek',
    calendarWeekCount: 2,
  },
  {
    name: 'calendar-week',
    url: '/calendar',
    description: 'Calendar schedule view (single-week timeline)',
    settleMs: 6000,
    calendarView: 'week',
  },
  {
    name: 'calendar-day',
    url: '/calendar',
    description: 'Calendar day view (side-by-side per-person columns)',
    settleMs: 6000,
    calendarView: 'day',
  },
  {
    name: 'calendar-agenda',
    url: '/calendar',
    description: 'Calendar agenda view (chronological list)',
    settleMs: 6000,
    calendarView: 'agenda',
  },
  {
    name: 'calendar-mobile',
    url: '/calendar',
    description: 'Mobile calendar (agenda-only)',
    mobile: true,
    settleMs: 5000,
    calendarView: 'agenda',
  },
  // Cards-mode variants: stacked event cards in each day cell, with overlay
  // rows below the calendar grid for meals/chores/tasks per day.
  {
    name: 'calendar-month-cards',
    url: '/calendar',
    description: 'Calendar month view in cards mode (with meal/chore/task overlays)',
    settleMs: 7000,
    calendarView: 'month',
    calendarDisplayMode: 'cards',
  },
  {
    name: 'calendar-multiweek-cards',
    url: '/calendar',
    description: 'Calendar multi-week view in cards mode (2 weeks)',
    settleMs: 7000,
    calendarView: 'multiWeek',
    calendarWeekCount: 2,
    calendarDisplayMode: 'cards',
  },
  {
    name: 'calendar-mobile-cards',
    url: '/calendar',
    description: 'Mobile calendar in cards mode',
    mobile: true,
    settleMs: 6000,
    calendarView: 'agenda',
    calendarDisplayMode: 'cards',
  },

  // ─── Shopping ──────────────────────────────────────────────
  { name: 'shopping', url: '/shopping', description: 'Shopping list with category grid', settleMs: 1000 },
  { name: 'shopping-mobile', url: '/shopping', description: 'Mobile shopping list', mobile: true, settleMs: 1000 },

  // ─── Lists and family pages ────────────────────────────────
  { name: 'recipes', url: '/recipes', description: 'Recipe library grid', settleMs: 1000 },
  { name: 'tasks', url: '/tasks', description: 'Tasks grouped by person', settleMs: 1500, setup: groupByPerson },
  { name: 'chores', url: '/chores', description: 'Chores grouped by person', settleMs: 1000 },
  { name: 'meals', url: '/meals', description: 'Weekly meal planner', settleMs: 1000 },
  { name: 'goals', url: '/goals', description: 'Goals page with points waterfall', settleMs: 1000 },
  {
    name: 'wishes',
    url: '/wishes',
    description: 'Wish lists grouped by person, with claim tracking',
    settleMs: 1500,
    setup: groupByPerson,
  },
  { name: 'photos', url: '/photos', description: 'Photo gallery', settleMs: 3500 },
  { name: 'travel-globe', url: '/travel', description: 'Travel map globe with pins', settleMs: 3500 },
  { name: 'weekend', url: '/weekend', description: 'Weekend Ideas activity board', settleMs: 3000 },
  { name: 'messages', url: '/messages', description: 'Family message board', settleMs: 1000 },
];

export const SCREENSHOTS: CaptureSpec[] = [...HERO_SHOTS, ...GALLERY_SHOTS, ...FEATURE_SHOTS];

/** The light or dark mode a shot runs in: its own, else its look's. */
export function themeOf(spec: CaptureSpec): 'light' | 'dark' | undefined {
  return spec.theme ?? (spec.stage && LOOKS[spec.stage.look].mode === 'dark' ? 'dark' : undefined);
}
