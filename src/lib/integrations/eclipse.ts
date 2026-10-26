/**
 * Eclipses seen from the weather location, worked out locally with
 * astronomy-engine. No network call: eclipses are as predictable as sunrise.
 *
 * Only what can actually be seen from there is reported: a solar eclipse while
 * the sun is up, a lunar one while the moon is. Penumbral lunar eclipses are
 * left out, because the moon only dims slightly and nobody would notice.
 */

import { Observer, SearchLocalSolarEclipse, SearchLunarEclipse } from 'astronomy-engine';
import * as SunCalc from 'suncalc';

export type Eclipse = {
  body: 'sun' | 'moon';
  /** How it looks from here at its peak. */
  kind: 'partial' | 'annular' | 'total';
  begin: Date;
  peak: Date;
  end: Date;
  /** How much of the disc is covered at the peak, 0..1. */
  obscuration: number;
}

const DAY_MS = 24 * 3_600_000;
const MINUTE_MS = 60_000;

/** The solar eclipse seen from here that overlaps [start, end), if any. */
function solar(lat: number, lon: number, start: number, end: number): Eclipse | undefined {
  // From a day early, so an eclipse already under way at midnight is found.
  const e = SearchLocalSolarEclipse(new Date(start - DAY_MS), new Observer(lat, lon, 0));
  const begin = e.partial_begin.time.date.getTime();
  const finish = e.partial_end.time.date.getTime();
  if (begin >= end || finish < start) return undefined;
  // The sun has to be up for some of it.
  if (Math.max(e.partial_begin.altitude, e.peak.altitude, e.partial_end.altitude) <= 0) return undefined;
  return {
    body: 'sun',
    kind: e.kind as Eclipse['kind'],
    begin: new Date(begin),
    peak: e.peak.time.date,
    end: new Date(finish),
    obscuration: e.obscuration,
  };
}

/** The lunar eclipse seen from here that overlaps [start, end), if any. */
function lunar(lat: number, lon: number, start: number, end: number): Eclipse | undefined {
  const e = SearchLunarEclipse(new Date(start - DAY_MS));
  if (e.kind === 'penumbral') return undefined;
  const peak = e.peak.date.getTime();
  // From the moon first touching the dark of the shadow to leaving it.
  const begin = peak - e.sd_partial * MINUTE_MS;
  const finish = peak + e.sd_partial * MINUTE_MS;
  if (begin >= end || finish < start) return undefined;
  const up = (t: number) => SunCalc.getMoonPosition(new Date(t), lat, lon).altitude > 0;
  if (!up(begin) && !up(peak) && !up(finish)) return undefined;
  return {
    body: 'moon',
    kind: e.kind as Eclipse['kind'],
    begin: new Date(begin),
    peak: new Date(peak),
    end: new Date(finish),
    obscuration: e.obscuration,
  };
}

/**
 * An eclipse seen from the location during the day that begins at `dayStart`
 * (its local midnight, as an instant), or undefined. There is at most one a
 * day: solar and lunar eclipses come a fortnight apart.
 */
export function eclipseForDay(lat: number, lon: number, dayStart: Date): Eclipse | undefined {
  const start = dayStart.getTime();
  const end = start + DAY_MS;
  return solar(lat, lon, start, end) ?? lunar(lat, lon, start, end);
}
