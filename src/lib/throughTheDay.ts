import { isNight, type IdleBackground, type IdleSource, type IdleSwitch } from './idleBackground';

/**
 * Through the day (#1152): the three states a screen is in, and the one rule
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

/** Which of the three states the screen is in at `now`. */
export function screenStateAt({ idle, now, rule, lat, lon }: {
  idle: boolean;
  now: Date;
  rule: IdleSwitch;
  lat: number;
  lon: number;
}): ScreenState {
  if (!idle) return 'active';
  return isNightAt(rule, now, lat, lon) ? 'night' : 'resting';
}

/** What shows behind the screen in a state: nothing extra while active, the dashboard. */
export function backdropFor(bg: IdleBackground, state: ScreenState): IdleSource {
  if (state === 'active') return 'dashboard';
  if ('source' in bg) return bg.source;
  return state === 'night' ? bg.night : bg.day;
}

/**
 * The background as the Through the day sheet edits it: always a resting and
 * a night backdrop with a rule, so night can be set even when both show the
 * same. A single background reads as the same thing by day and by night.
 */
export function asDayAndNight(bg: IdleBackground): { day: IdleSource; night: IdleSource; switch: IdleSwitch } {
  if ('switch' in bg) return bg;
  return { day: bg.source, night: bg.source, switch: DEFAULT_NIGHT };
}
