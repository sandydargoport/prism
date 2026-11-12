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
import * as path from 'path';
import { SCENERY } from '../src/lib/scenery';
import { LOOKS, type LookId } from '../src/lib/looks';
import { TODAY_TEMPLATE } from '../src/lib/constants/layoutTemplates';

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
 * 'simple' is the Simple front page (#1117): the day drawn as one scene.
 */
export type Stage = {
  look: LookId;
  layout: 'hero' | 'gallery' | 'simple' | 'kitchen';
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
  /**
   * The bundled park photo the scenery opens on for this shot (an id from
   * src/lib/scenery.ts), so each shot gets the landscape that suits it (#1142).
   * The capture serves it in place of the first scenery file; the app is unchanged.
   */
  photo?: string;
  /** Shoot only this dashboard widget, close up, instead of the whole screen. */
  widget?: StagedWidget;
  /** Shown in the docs gallery (docs/screenshots.md). */
  gallery?: boolean;
  /**
   * Shoot this many minutes before (negative) or after the fixed moment, the
   * same day: the morning and the evening of the day the seed draws.
   */
  shiftMinutes?: number;
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

/** Simple's parts, as the premade Today page places them. */
export const SIMPLE_LAYOUT = TODAY_TEMPLATE.widgets.map((w) => ({
  i: w.i as StagedWidget, x: w.x, y: w.y, w: w.w, h: w.h, showWhenIdle: w.showWhenIdle ?? false,
})) satisfies StagedCell[];

/**
 * A family's own kitchen dashboard (#1142), made up for the gallery: the week
 * on the left where everyone passes, today's chores beside it, the shopping
 * list and the birthdays coming up on the right, with the clock and weather
 * across the top. Every name and event is the seeded demo family's.
 */
export const KITCHEN_LAYOUT = [
  { i: 'clock', x: 0, y: 0, w: 12, h: 5, showWhenIdle: true },
  { i: 'weather', x: 36, y: 0, w: 12, h: 5, showWhenIdle: true },
  { i: 'calendar', x: 0, y: 5, w: 24, h: 22, showWhenIdle: false },
  { i: 'chores', x: 24, y: 5, w: 12, h: 22, showWhenIdle: false },
  { i: 'shopping', x: 36, y: 5, w: 12, h: 13, showWhenIdle: false },
  { i: 'birthdays', x: 36, y: 18, w: 12, h: 9, showWhenIdle: false },
] satisfies StagedCell[];

export const STAGE_LAYOUTS = { hero: HERO_LAYOUT, gallery: GALLERY_LAYOUT, simple: SIMPLE_LAYOUT, kitchen: KITCHEN_LAYOUT } as const;

/** The bundled file for a scenery id; throws on an id that is not bundled. */
export function scenerySource(id: string): string {
  const s = SCENERY.find((x) => x.id === id);
  if (!s) throw new Error(`No bundled scenery photo "${id}"; see src/lib/scenery.ts`);
  return path.join(__dirname, '..', 'public', s.src);
}

/** The landscapes (#1142): the most striking for the hero and Simple, then one to suit each hour. */
export const PHOTOS = {
  hero: 'dunes-sunset',
  morning: 'morning-hills',
  afternoon: 'dunes-sunset',
  evening: 'river-sunset',
  night: 'lake-clouds',
} as const;

/**
 * The hero set: the same moment on a wall, a tablet and a phone, in light and
 * dark. frame-screenshots.ts puts each trio into device frames afterwards.
 * Each device shows a different side of it: the wall the dashboard, the
 * tablet the idle screen (the photo with the clock and weather), the phone
 * the mobile home. The wall and the tablet are signed out, as they would be
 * in a kitchen; the phone is a parent's, signed in. They show a new install
 * in the Photo look, on the Simple front page a new install starts on.
 */
export const HERO_SHOTS: CaptureSpec[] = (['light', 'dark'] as const).flatMap((theme) => {
  const stage: Stage = { look: 'photo', layout: 'simple' };
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
      photo: PHOTOS.hero,
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
      photo: PHOTOS.hero,
      settleMs: 15000,
    },
    {
      name: `hero-phone-${theme}`,
      url: '/',
      description: `Phone, signed in (${theme})`,
      theme,
      device: 'phone' as const,
      stage,
      photo: PHOTOS.hero,
      settleMs: 15000,
    },
  ];
});

/** A signed-out wall, rail and bar hidden, in a look on one of the staged dashboards. */
const wall = (look: LookId, layout: Stage['layout'] = 'gallery') => ({
  url: '/',
  device: 'wall' as const,
  signedOut: true,
  idleChrome: true,
  stage: { look, layout },
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
 * The gallery: what a family sees. The Simple wall in the Photo and Night
 * looks, a family's own kitchen layout in Paper, the idle screen, the widgets they use close up, and a parent's
 * phone. Admin and editing screens stay out; the feature docs show those.
 */
export const GALLERY_SHOTS: CaptureSpec[] = [
  { name: 'wall-simple', description: 'The Simple wall in the Photo look', ...wall('photo', 'simple'), photo: PHOTOS.hero },
  { name: 'wall-night', description: 'The Simple wall in the Night look', ...wall('night', 'simple'), photo: PHOTOS.night },
  { name: 'wall-kitchen', description: "A family's own kitchen layout in the Paper look", ...wall('paper', 'kitchen') },
  {
    name: 'idle-screen',
    description: 'The wall when nobody is using it: the photo, the clock and the weather',
    ...wall('photo'),
    idle: true,
    photo: PHOTOS.hero,
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

/**
 * The docs front page's "A day at home" tabs: the same Simple wall in the
 * morning, after school and in the evening. The fixed moment is 4:10 PM, so
 * these are 7:30 AM (the whole day ahead), 5:40 PM (soccer done, scouts next)
 * and 8:45 PM (the day over, after sunset).
 */
export const DAY_SHOTS: CaptureSpec[] = [
  { name: 'day-morning', when: 'morning', shiftMinutes: -520, photo: PHOTOS.morning },
  { name: 'day-afternoon', when: 'after school', shiftMinutes: 90, photo: PHOTOS.afternoon },
  { name: 'day-evening', when: 'evening', shiftMinutes: 275, photo: PHOTOS.evening },
].map(({ name, when, shiftMinutes, photo }) => ({
  name,
  url: '/',
  description: `The Simple wall in the ${when}`,
  device: 'wall' as const,
  signedOut: true,
  idleChrome: true,
  stage: { look: 'photo' as const, layout: 'simple' as const },
  photo,
  shiftMinutes,
  settleMs: 15000,
}));

export const SCREENSHOTS: CaptureSpec[] = [...HERO_SHOTS, ...GALLERY_SHOTS, ...DAY_SHOTS, ...FEATURE_SHOTS];

/** The light or dark mode a shot runs in: its own, else its look's. */
export function themeOf(spec: CaptureSpec): 'light' | 'dark' | undefined {
  return spec.theme ?? (spec.stage && LOOKS[spec.stage.look].mode === 'dark' ? 'dark' : undefined);
}
