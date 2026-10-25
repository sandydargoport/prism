import {
  localSiderealTime, toHorizontal, sunPosition, moonPosition, skyShowsNow, skyLight, project, facingFor,
} from '../sky';
import { STARS, LINES } from '../catalog';

// A fictional household somewhere mid-latitude, west of Greenwich.
const LAT = 45;
const LON = -100;

describe('night sky positions', () => {
  it('has the sidereal time at the J2000 epoch', () => {
    expect(localSiderealTime(new Date('2000-01-01T12:00:00Z'), 0)).toBeCloseTo(280.46, 1);
  });

  it('puts the pole star at the latitude, due north, at any hour', () => {
    // Polaris is within a degree of the pole, so its altitude is the latitude
    // and it never wanders from north. Wrong sidereal time or a sign slip in
    // the hour angle moves it.
    for (const iso of ['2026-01-10T03:00:00Z', '2026-07-01T15:30:00Z']) {
      const p = toHorizontal(37.95, 89.26, LAT, localSiderealTime(new Date(iso), LON));
      expect(Math.abs(p.alt - LAT)).toBeLessThan(1);
      expect(Math.min(p.az, 360 - p.az)).toBeLessThan(1.5);
    }
  });

  it('puts a star crossing the meridian due south, at 90 minus latitude plus declination', () => {
    const lst = 100;
    const p = toHorizontal(lst, 10, LAT, lst);
    expect(p.az).toBeCloseTo(180, 5);
    expect(p.alt).toBeCloseTo(90 - LAT + 10, 5);
  });

  it('rises in the east and sets in the west', () => {
    // Six hours before transit the hour angle is negative: east of the meridian.
    const east = toHorizontal(100, 0, LAT, 100 - 60);
    const west = toHorizontal(100, 0, LAT, 100 + 60);
    expect(east.az).toBeGreaterThan(90);
    expect(east.az).toBeLessThan(180);
    expect(west.az).toBeGreaterThan(180);
    expect(west.az).toBeLessThan(270);
  });

  it('reads suncalc in degrees from north: the sun is high and southern at local noon', () => {
    // Local solar noon at -100 degrees is about 18:42 UTC.
    const sun = sunPosition(new Date('2026-06-21T18:42:00Z'), LAT, LON);
    expect(sun.alt).toBeGreaterThan(64);
    expect(sun.alt).toBeLessThan(72);
    expect(Math.abs(sun.az - 180)).toBeLessThan(10);
  });

  it('has a full moon fully lit and a new moon dark', () => {
    // Full moon 2026-10-26, new moon 2026-11-09.
    expect(moonPosition(new Date('2026-10-26T04:00:00Z'), LAT, LON).fraction).toBeGreaterThan(0.97);
    expect(moonPosition(new Date('2026-11-09T12:00:00Z'), LAT, LON).fraction).toBeLessThan(0.03);
  });
});

describe('which backdrop shows', () => {
  const noon = new Date('2026-06-21T18:42:00Z');
  const midnight = new Date('2026-06-22T06:42:00Z');

  it('photos only ever shows photos, and sky only ever the sky', () => {
    expect(skyShowsNow('photos', midnight, LAT, LON)).toBe(false);
    expect(skyShowsNow('sky', noon, LAT, LON)).toBe(true);
  });

  it('after dark shows photos by day and the sky by night', () => {
    expect(skyShowsNow('skyAtNight', noon, LAT, LON)).toBe(false);
    expect(skyShowsNow('skyAtNight', midnight, LAT, LON)).toBe(true);
  });

  it('changes over at sunset, not at some fixed hour', () => {
    // Sunset at 45N, 100W on the solstice is about 02:30 UTC; in winter it is
    // about 23:15 UTC. The same clock time is day in June and night in December.
    expect(skyShowsNow('skyAtNight', new Date('2026-06-22T00:30:00Z'), LAT, LON)).toBe(false);
    expect(skyShowsNow('skyAtNight', new Date('2026-12-22T00:30:00Z'), LAT, LON)).toBe(true);
  });
});

describe('sky light and projection', () => {
  it('shows no stars in daylight and all of them in full dark', () => {
    expect(skyLight(10).stars).toBe(0);
    expect(skyLight(-20).stars).toBe(1);
    expect(skyLight(-6).stars).toBeGreaterThan(0);
    expect(skyLight(-6).stars).toBeLessThan(1);
  });

  it('puts the horizon at the bottom and the zenith above the middle', () => {
    const v = { width: 1920, height: 1080, facing: facingFor(LAT) };
    const horizon = project({ alt: 0, az: 180 }, v);
    const high = project({ alt: 60, az: 180 }, v);
    expect(horizon.x).toBeCloseTo(960, 5);
    expect(horizon.y).toBeGreaterThan(1080 * 0.95);
    expect(high.y).toBeLessThan(1080 * 0.4);
    // East is on the left when facing south.
    expect(project({ alt: 20, az: 150 }, v).x).toBeLessThan(960);
  });

  it('faces north in the southern hemisphere', () => {
    expect(facingFor(-33)).toBe(0);
  });

  it('has the catalogue it draws from', () => {
    expect(STARS.length / 4).toBeGreaterThan(800);
    expect(LINES.length).toBeGreaterThan(100);
    // Sirius is the brightest star and comes first.
    expect(STARS.slice(0, 3)).toEqual([101.3, -16.7, -1.4]);
  });
});
