import * as SunCalc from 'suncalc';
import { z } from 'zod';

/**
 * What a dashboard shows behind it when nobody is using the display (#782).
 *
 * Stored with the dashboard. Either one background all the time, or one by day
 * and one after dark, switching at dusk and dawn (each moved by an offset) or
 * at set times on the clock.
 *
 *  - dashboard: the dashboard itself stays up, with only the widgets marked to
 *    stay showing (calm mode, #691).
 *  - photos: the screensaver layout over the photo slideshow.
 *  - sky: the screensaver layout over the night sky.
 */

export const IDLE_SOURCES = ['dashboard', 'photos', 'sky'] as const;
export type IdleSource = (typeof IDLE_SOURCES)[number];

/** An offset can move an edge by up to half a day either way. */
export const MAX_OFFSET_MINUTES = 12 * 60;

const source = z.enum(IDLE_SOURCES);
const offset = z.number().int().min(-MAX_OFFSET_MINUTES).max(MAX_OFFSET_MINUTES);
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const idleSwitchSchema = z.union([
  // Minutes; positive is later. Dusk and dawn are sunset and sunrise, as the
  // "after dark" background always switched.
  z.object({ by: z.literal('sun'), duskOffset: offset, dawnOffset: offset }).strict(),
  // Local times on the display's clock; a span may cross midnight.
  z.object({ by: z.literal('clock'), from: clockTime, to: clockTime }).strict()
    .refine((s) => s.from !== s.to, 'Night must start and end at different times'),
]);

export const idleBackgroundSchema = z.union([
  z.object({ source }).strict(),
  z.object({ day: source, night: source, switch: idleSwitchSchema }).strict(),
]);

export type IdleSwitch = z.infer<typeof idleSwitchSchema>;
export type IdleBackground = z.infer<typeof idleBackgroundSchema>;

/** What a display with no dashboard of its own shows: the photo screensaver, as before. */
export const PHOTOS: IdleBackground = { source: 'photos' };

/** A stored value, or photos if it is missing or not one we know. */
export function parseIdleBackground(raw: unknown): IdleBackground {
  const parsed = idleBackgroundSchema.safeParse(raw);
  return parsed.success ? parsed.data : PHOTOS;
}

/**
 * Whether two values mean the same. The database hands JSON back with its keys
 * in its own order, so comparing the text is not enough.
 */
export function sameIdleBackground(a: IdleBackground, b: IdleBackground): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function canonical(bg: IdleBackground): unknown {
  if ('source' in bg) return [bg.source];
  const sw = bg.switch;
  return [bg.day, bg.night, sw.by === 'sun' ? [sw.duskOffset, sw.dawnOffset] : [sw.from, sw.to]];
}

/** Every background it can show, by day and after dark. */
export function idleSources(bg: IdleBackground): IdleSource[] {
  return 'source' in bg ? [bg.source] : [bg.day, bg.night];
}

/** Whether it can show `s` at some time of day. */
export function usesSource(bg: IdleBackground, s: IdleSource): boolean {
  return idleSources(bg).includes(s);
}

/** Whether working out what shows needs the household location. */
export function needsLocation(bg: IdleBackground): boolean {
  return usesSource(bg, 'sky') || ('switch' in bg && bg.switch.by === 'sun');
}

/**
 * The same background with the dashboard swapped for photos, for a place that
 * has no dashboard to show: the phone layout, or any other page.
 */
export function withoutDashboard(bg: IdleBackground): IdleBackground {
  const swap = (s: IdleSource): IdleSource => (s === 'dashboard' ? 'photos' : s);
  if ('source' in bg) return { source: swap(bg.source) };
  return { ...bg, day: swap(bg.day), night: swap(bg.night) };
}

export type NightSpan = { start: Date; end: Date };

/** Degrees the sun sits below the horizon at sunset, refraction included. */
const SUNSET_ALT = -0.833;
const MINUTE = 60_000;

/** Noon on the local calendar day `days` after the one `now` falls in. */
function localNoon(now: Date, days: number): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 12);
}

function atClock(day: Date, hhmm: string, days = 0): Date {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + days, h, m);
}

// suncalc gives null (or an invalid date) when the sun does not set or rise that day.
const valid = (d: Date | null | undefined): d is Date => !!d && !Number.isNaN(d.getTime());

/**
 * Where the night that starts on the local day of `noon` would begin and end,
 * offsets applied, even if they cross. Null when the sun does not set or rise
 * there that day.
 */
function nightBounds(noon: Date, sw: IdleSwitch, lat: number, lon: number): NightSpan | null {
  if (sw.by === 'clock') {
    // "HH:MM" strings compare in time order.
    return { start: atClock(noon, sw.from), end: atClock(noon, sw.to, sw.to < sw.from ? 1 : 0) };
  }
  const sunset = SunCalc.getTimes(noon, lat, lon).sunset;
  const sunrise = SunCalc.getTimes(localNoon(noon, 1), lat, lon).sunrise;
  if (!valid(sunset) || !valid(sunrise)) return null;
  return {
    start: new Date(sunset.getTime() + sw.duskOffset * MINUTE),
    end: new Date(sunrise.getTime() + sw.dawnOffset * MINUTE),
  };
}

/**
 * The night that starts on the local day of `noon`, or null when there is none:
 * the sun never sets or never rises there that day, or the offsets cross so
 * night would end before it starts.
 */
function nightOf(noon: Date, sw: IdleSwitch, lat: number, lon: number): NightSpan | null {
  const span = nightBounds(noon, sw, lat, lon);
  return span && span.start < span.end ? span : null;
}

/**
 * The first night in the coming year, from `now`, on which the offsets cross
 * so night would end before it starts, or null if they never do. Near
 * midsummer far from the equator dusk and dawn are only hours apart, and the
 * editor refuses such a setting rather than leave the screen without a night.
 */
export function firstCrossedNight(now: Date, sw: IdleSwitch, lat: number, lon: number): Date | null {
  if (sw.by === 'clock') return null;
  for (let days = 0; days < 366; days++) {
    const noon = localNoon(now, days);
    const span = nightBounds(noon, sw, lat, lon);
    if (span && span.start >= span.end) return noon;
  }
  return null;
}

/**
 * The night in progress at `now`, or the next one to come: what the editor
 * shows as tonight's times. Null when there is none in the next day, which
 * near midsummer far north is what crossed offsets give.
 */
export function tonight(now: Date, sw: IdleSwitch, lat: number, lon: number): NightSpan | null {
  for (const days of [-1, 0, 1]) {
    const span = nightOf(localNoon(now, days), sw, lat, lon);
    if (span && span.end > now) return span;
  }
  return null;
}

/** Whether `now` falls in a night, by the switch's own rule. */
export function isNight(now: Date, sw: IdleSwitch, lat: number, lon: number): boolean {
  if (sw.by === 'sun') {
    // Polar day or night: no sunset to go by, so it is night while the sun is down.
    const today = SunCalc.getTimes(localNoon(now, 0), lat, lon);
    if (!valid(today.sunset) || !valid(today.sunrise)) {
      return SunCalc.getPosition(now, lat, lon).altitude < SUNSET_ALT;
    }
  }
  const span = tonight(now, sw, lat, lon);
  return !!span && span.start <= now;
}

/** What shows at `now`. */
export function idleSourceAt(bg: IdleBackground, now: Date, lat: number, lon: number): IdleSource {
  if ('source' in bg) return bg.source;
  return isNight(now, bg.switch, lat, lon) ? bg.night : bg.day;
}
