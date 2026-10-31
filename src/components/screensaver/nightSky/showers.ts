import { localSiderealTime, moonPosition, toHorizontal, type Horizontal } from './sky';

/**
 * The major annual meteor showers, from the International Meteor
 * Organization's calendar: the ten with a typical peak rate of ten an hour or
 * more. Worked out locally like the rest of the sky, no network.
 *
 * Peaks fall on the same dates each year to within about a day (they are set
 * by where the Earth is in its orbit), which is closer than "tonight" needs.
 * The radiant is where it is at the peak; it drifts a degree or so a day.
 */
export type Shower = {
  name: string;
  /** Peak, as month (1-12) and day. */
  peak: [number, number];
  /** Radiant at the peak, degrees. */
  ra: number;
  dec: number;
  /** Typical zenithal hourly rate: meteors an hour under a perfect sky with the radiant overhead. */
  rate: number;
}

export const SHOWERS: Shower[] = [
  { name: 'Quadrantids', peak: [1, 3], ra: 230, dec: 49, rate: 80 },
  { name: 'Lyrids', peak: [4, 22], ra: 271, dec: 34, rate: 18 },
  { name: 'Eta Aquariids', peak: [5, 6], ra: 338, dec: -1, rate: 50 },
  { name: 'Southern Delta Aquariids', peak: [7, 31], ra: 340, dec: -16, rate: 25 },
  { name: 'Perseids', peak: [8, 12], ra: 48, dec: 58, rate: 100 },
  { name: 'Draconids', peak: [10, 8], ra: 262, dec: 54, rate: 10 },
  { name: 'Orionids', peak: [10, 21], ra: 95, dec: 16, rate: 20 },
  { name: 'Leonids', peak: [11, 17], ra: 152, dec: 22, rate: 15 },
  { name: 'Geminids', peak: [12, 14], ra: 112, dec: 33, rate: 150 },
  { name: 'Ursids', peak: [12, 22], ra: 217, dec: 76, rate: 10 },
];

const DAY_MS = 86_400_000;
/** "The nights around the peak": this long either side of it. */
const AROUND_PEAK_MS = 1.5 * DAY_MS;
/** Below this the radiant is too low for the shower to be worth a mention. */
const MIN_RADIANT_ALT = 10;
/** A moon at least this full and up washes out all but the brightest meteors. */
const BRIGHT_MOON = 0.6;

export type ActiveShower = {
  shower: Shower;
  radiant: Horizontal;
  /** A bright moon is up and will hide the fainter meteors. */
  moonWashesOut: boolean;
}

/** The peak nearest `date`, as an instant (local noon on the peak day, so either night counts). */
function nearestPeak(shower: Shower, date: Date): number {
  const [m, d] = shower.peak;
  const y = date.getFullYear();
  const now = date.getTime();
  // Either side of new year: the Quadrantids peak on 3 January.
  return [y - 1, y, y + 1]
    .map((yr) => new Date(yr, m - 1, d, 12).getTime())
    .reduce((best, t) => (Math.abs(t - now) < Math.abs(best - now) ? t : best));
}

/**
 * The shower worth mentioning right now, if any: one within a night or so of
 * its peak whose radiant is up. The busiest wins if two overlap.
 */
export function activeShower(date: Date, lat: number, lon: number): ActiveShower | null {
  const lst = localSiderealTime(date, lon);
  let best: ActiveShower | null = null;
  for (const shower of SHOWERS) {
    if (Math.abs(nearestPeak(shower, date) - date.getTime()) > AROUND_PEAK_MS) continue;
    const radiant = toHorizontal(shower.ra, shower.dec, lat, lst);
    if (radiant.alt < MIN_RADIANT_ALT) continue;
    if (best && best.shower.rate >= shower.rate) continue;
    best = { shower, radiant, moonWashesOut: false };
  }
  if (best) {
    const moon = moonPosition(date, lat, lon);
    best.moonWashesOut = moon.alt > 0 && moon.fraction >= BRIGHT_MOON;
  }
  return best;
}

/** The line shown on the sky. */
export function showerNotice(a: ActiveShower): string {
  const line = `${a.shower.name} peak tonight, up to ${a.shower.rate} an hour`;
  return a.moonWashesOut ? `${line}, though the bright moon will hide the fainter ones` : line;
}

/**
 * Average wait between the sky's shooting stars during a shower, in
 * milliseconds, against two to six minutes on an ordinary night. Scaled by the
 * rate, so the Geminids are busier than the Ursids, but never so busy it stops
 * being an event: even a strong shower is one every minute or so to the eye.
 */
export function meteorWait(a: ActiveShower): number {
  return Math.max(20_000, Math.min(90_000, 3_000_000 / a.shower.rate));
}

/**
 * Screen angle, in degrees clockwise from rightward, for a meteor starting at
 * (x, y) that belongs to a shower whose radiant is at (rx, ry): straight away
 * from the radiant, which is what makes a shower look like a shower.
 */
export function angleFromRadiant(x: number, y: number, rx: number, ry: number): number {
  return (Math.atan2(y - ry, x - rx) * 180) / Math.PI;
}
