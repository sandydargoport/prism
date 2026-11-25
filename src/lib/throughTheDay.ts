import { shouldShowScreensaver } from '@/components/screensaver/shouldShowScreensaver';
import { isNight, type IdleBackground, type IdleSource, type IdleSwitch } from './idleBackground';

/**
 * A screen's day (#1152): the three states a screen is in, and the one rule
 * for night that every part of the app goes by.
 *
 *  - active: someone is using it.
 *  - resting: nobody has touched it for a while, by day.
 *  - night: nobody has touched it, and it is night by the dashboard's rule.
 *
 * Before this, night meant three things: Calendar Hours drove the dimming,
 * dusk and dawn drove the idle background, and sunset drove Today's veil.
 * Now Today's veil and warm ink, the dimming and the night backdrop all ask
 * `isNightAt` with the dashboard's own rule.
 */

export type ScreenState = 'active' | 'resting' | 'night';

/**
 * Night when a dashboard has not set its own: half an hour after sunset to
 * half an hour before sunrise, the hours Today's veil always used (#926), so
 * nothing changes on a screen nobody has set up.
 */
export const DEFAULT_NIGHT: IdleSwitch = { by: 'sun', duskOffset: 30, dawnOffset: -30 };

/** The dashboard's night: its own switch when it has one, the default when not. */
export function nightRule(bg: IdleBackground): IdleSwitch {
  return 'switch' in bg ? bg.switch : DEFAULT_NIGHT;
}

/** Whether `now` is night by `rule`, at the place `lat`, `lon`. */
export function isNightAt(rule: IdleSwitch, now: Date, lat: number, lon: number): boolean {
  return isNight(now, rule, lat, lon);
}

/**
 * The moment a scene is asked about: a time and a place, which the night rule
 * reads, or night given outright, as the editor's Resting and Night previews
 * do.
 */
export type SceneMoment = { now: Date; lat: number; lon: number } | { night: boolean };

export type SceneInput = {
  /** Nobody has touched the screen for its idle time, or the editor shows it idle. */
  idle: boolean;
  /** The dashboard's idle background: what shows when idle, and its night rule. */
  background: IdleBackground;
  at: SceneMoment;
  /** How dark at night, as the opacity of the black over the screen (0 is off). */
  dimLevel?: number;
  /** Away mode is on: its own screen is up, so this one stays in use. */
  away?: boolean;
  /** Sitter mode is on: the same. */
  sitter?: boolean;
  /** A dashboard is being edited on this page: the screen never goes idle over the editor (#1342). */
  editing?: boolean;
  /** Whether this screen can idle at all. */
  canIdle?: boolean;
};

/** What a screen shows at a moment. */
export type Scene = {
  /** In use, idle by day, or idle at night. */
  state: ScreenState;
  /** Night by the dashboard's rule, whether or not anyone is using the screen. */
  night: boolean;
  /** What shows: the dashboard while in use, otherwise the idle look for the state. */
  look: IdleSource;
  /** The black drawn over the screen: the dim level while idle at night, otherwise 0. */
  dim: number;
};

/**
 * The one answer to "what is on this screen now" (#1344). The wall, Glance's
 * night veil and the editor's preview all ask it, so none of them can work
 * out a different day from the others.
 *
 * Away and Sitter keep the screen in use (see shouldShowScreensaver), so the
 * dim and the idle look wait for them to end.
 */
export function screenStateAt({
  idle, background, at, dimLevel = 0, away = false, sitter = false, editing = false, canIdle = true,
}: SceneInput): Scene {
  const night = 'night' in at ? at.night : isNightAt(nightRule(background), at.now, at.lat, at.lon);
  const resting = canIdle && shouldShowScreensaver({ idle, away, babysitter: sitter, editing });
  const state: ScreenState = !resting ? 'active' : night ? 'night' : 'resting';
  return { state, night, look: backdropFor(background, state), dim: resting && night ? dimLevel : 0 };
}

/** What shows behind the screen in a state: nothing extra while active, the dashboard. */
export function backdropFor(bg: IdleBackground, state: ScreenState): IdleSource {
  if (state === 'active') return 'dashboard';
  if ('source' in bg) return bg.source;
  return state === 'night' ? bg.night : bg.day;
}

/**
 * The background as the Screen tab edits it: always a resting and
 * a night backdrop with a rule, so night can be set even when both show the
 * same. A single background reads as the same thing by day and by night.
 */
export function asDayAndNight(bg: IdleBackground): { day: IdleSource; night: IdleSource; switch: IdleSwitch } {
  if ('switch' in bg) return bg;
  return { day: bg.source, night: bg.source, switch: DEFAULT_NIGHT };
}
