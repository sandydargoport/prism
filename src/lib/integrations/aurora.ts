/**
 * Aurora from NOAA's Space Weather Prediction Center: the OVATION model's
 * short-range forecast, a grid of the chance of aurora overhead at every whole
 * degree of latitude and longitude, renewed every few minutes and good for
 * about the next hour. Free, no key.
 *
 * The grid is about 900 KB, so only the server fetches it, and each display is
 * told a single word: whether aurora may be overhead here, low on the horizon
 * toward the pole, or neither.
 */

export const OVATION_URL = 'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json';

/** The household setting that turns it on: true or absent. Off by default. */
export const AURORA_SETTING = 'nightSkyAurora';

/** Where aurora may be seen from here, if anywhere. */
export type AuroraChance = 'overhead' | 'horizon' | null;

export type AuroraResponse =
  | { enabled: false }
  | { enabled: true; chance: AuroraChance; forecastAt?: string };

/** The chance, in percent, at which NOAA's own map starts to colour the oval. */
const SEEN = 10;
/**
 * How far toward the pole aurora can be and still be seen low on the horizon.
 * Its glow is 100 km up and more, so it shows over the horizon from several
 * hundred kilometres away; eight degrees is about 900 km.
 */
const HORIZON_REACH = 8;
/** Degrees of longitude either side, about the width of sky you would look over. */
const SPREAD = 6;

/** The grid as NOAA sends it: [longitude 0..359, latitude -90..90, percent]. */
export type OvationGrid = { 'Forecast Time'?: string; coordinates: [number, number, number][] };

/** The forecast for one place from the whole grid. */
export function auroraAt(grid: OvationGrid, lat: number, lon: number): AuroraChance {
  const chance = new Map<number, number>();
  for (const [x, y, v] of grid.coordinates) chance.set(x * 1000 + (y + 90), v);
  const at = (x: number, y: number) => chance.get((((x % 360) + 360) % 360) * 1000 + (y + 90)) ?? 0;

  const y0 = Math.round(lat);
  const x0 = Math.round(lon);
  if (at(x0, y0) >= SEEN) return 'overhead';
  // Toward the pole: north in the northern hemisphere, south in the southern.
  const pole = lat >= 0 ? 1 : -1;
  for (let d = 1; d <= HORIZON_REACH; d++) {
    const y = y0 + pole * d;
    if (Math.abs(y) > 90) break;
    for (let dx = -SPREAD; dx <= SPREAD; dx++) {
      if (at(x0 + dx, y) >= SEEN) return 'horizon';
    }
  }
  return null;
}

/** Fetches the latest grid and reads it for one place. Throws if NOAA does not answer in time. */
export async function fetchAurora(lat: number, lon: number): Promise<{ chance: AuroraChance; forecastAt?: string }> {
  const res = await fetch(OVATION_URL, { signal: AbortSignal.timeout(10_000), cache: 'no-store' });
  if (!res.ok) throw new Error(`NOAA aurora forecast: HTTP ${res.status}`);
  const grid = (await res.json()) as OvationGrid;
  if (!Array.isArray(grid?.coordinates)) throw new Error('NOAA aurora forecast: unexpected shape');
  return { chance: auroraAt(grid, lat, lon), forecastAt: grid['Forecast Time'] };
}

/** The line on the night sky, or null when there is nothing to say. */
export function auroraNotice(chance: AuroraChance, lat: number): string | null {
  const toward = lat >= 0 ? 'north' : 'south';
  if (chance === 'overhead') return `Aurora may be overhead now. Look up and to the ${toward}`;
  if (chance === 'horizon') return `Aurora possible now, low in the ${toward}ern sky`;
  return null;
}
