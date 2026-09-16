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

/**
 * Compute moon data for a given location and date (defaults to "now"). The
 * date determines which 24-hour window suncalc searches for rise/set — pass
 * a Date in the location's local timezone for results that match the user's
 * displayed calendar day.
 */
export function getMoonData(lat: number, lon: number, date: Date = new Date()): MoonData {
  const times = SunCalc.getMoonTimes(date, lat, lon);
  const illum = SunCalc.getMoonIllumination(date);

  return {
    moonrise: times.rise instanceof Date ? times.rise : undefined,
    moonset:  times.set  instanceof Date ? times.set  : undefined,
    moonPhase: illum.phase,
    moonIllumination: illum.fraction,
    moonPhaseName: phaseName(illum.phase),
  };
}
