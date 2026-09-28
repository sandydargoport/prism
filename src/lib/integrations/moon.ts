/**
 * Local astronomical moon computations via the `suncalc` library.
 *
 * Open-Meteo, OpenWeatherMap (free tier), and Pirate Weather do not expose
 * moonrise/moonset/phase, so we compute them locally. suncalc is deterministic
 * from lat/lon/date — no network call — and accurate to roughly a minute.
 *
 * The same payload is appended to every provider's WeatherData so the widget
 * does not have to know which provider produced the rest of the response.
 */

import * as SunCalc from 'suncalc';

export type MoonPhaseName =
  | 'New Moon'
  | 'Waxing Crescent'
  | 'First Quarter'
  | 'Waxing Gibbous'
  | 'Full Moon'
  | 'Waning Gibbous'
  | 'Last Quarter'
  | 'Waning Crescent';

export interface MoonData {
  /** Local moonrise for the given date, or undefined if the moon does not rise that day. */
  moonrise?: Date;
  /** Local moonset for the given date, or undefined if the moon does not set that day. */
  moonset?: Date;
  /** Phase angle 0..1 — 0 = new, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter. */
  moonPhase: number;
  /** Illuminated fraction 0..1 — independent of waxing vs waning. */
  moonIllumination: number;
  /** Human-readable phase label. */
  moonPhaseName: MoonPhaseName;
}

function phaseName(phase: number): MoonPhaseName {
  // Buckets ±0.0625 around each quarter; matches NOAA/USNO conventions.
  if (phase < 0.0625 || phase >= 0.9375) return 'New Moon';
  if (phase < 0.1875) return 'Waxing Crescent';
  if (phase < 0.3125) return 'First Quarter';
  if (phase < 0.4375) return 'Waxing Gibbous';
  if (phase < 0.5625) return 'Full Moon';
  if (phase < 0.6875) return 'Waning Gibbous';
  if (phase < 0.8125) return 'Last Quarter';
  return 'Waning Crescent';
}

const DAY_MS = 24 * 3_600_000;

/**
 * The first moonrise and moonset in [dayStart, dayStart + 24h).
 *
 * suncalc searches the UTC calendar day of the date it is given, not the
 * location's, which is the wrong day for anywhere far from Greenwich. So
 * search the two UTC days the location's day overlaps and keep what falls
 * inside it.
 */
function moonTimesForDay(lat: number, lon: number, dayStart: Date): { rise?: Date; set?: Date } {
  const start = dayStart.getTime();
  const end = start + DAY_MS;
  const inDay = (d: unknown): d is Date =>
    d instanceof Date && d.getTime() >= start && d.getTime() < end;
  const found = [new Date(start), new Date(start + DAY_MS)].map((d) => SunCalc.getMoonTimes(d, lat, lon));
  const pick = (key: 'rise' | 'set') =>
    found
      .map((t) => t[key])
      .filter(inDay)
      .sort((a, b) => a.getTime() - b.getTime())[0];
  return { rise: pick('rise'), set: pick('set') };
}

/**
 * Compute moon data for a location. Phase and illumination are for `now`;
 * moonrise and moonset are those of the location's day that begins at
 * `dayStart` (its local midnight, as an instant). Without `dayStart`,
 * suncalc's own day is used, which is the UTC day of `now`.
 */
export function getMoonData(lat: number, lon: number, now: Date = new Date(), dayStart?: Date): MoonData {
  const times = dayStart ? moonTimesForDay(lat, lon, dayStart) : SunCalc.getMoonTimes(now, lat, lon);
  const illum = SunCalc.getMoonIllumination(now);

  return {
    moonrise: times.rise instanceof Date ? times.rise : undefined,
    moonset:  times.set  instanceof Date ? times.set  : undefined,
    moonPhase: illum.phase,
    moonIllumination: illum.fraction,
    moonPhaseName: phaseName(illum.phase),
  };
}
