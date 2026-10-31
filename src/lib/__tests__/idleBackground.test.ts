import {
  firstCrossedNight, idleBackgroundSchema, idleSourceAt, sameIdleBackground, isNight, parseIdleBackground, tonight, usesSource, withoutDashboard,
  type IdleBackground, type IdleSwitch,
} from '../idleBackground';

// A fictional household somewhere mid-latitude, west of Greenwich.
const LAT = 45;
const LON = -100;
const MIN = 60_000;

const sun = (duskOffset = 0, dawnOffset = 0): IdleSwitch => ({ by: 'sun', duskOffset, dawnOffset });
const pair = (sw: IdleSwitch): IdleBackground => ({ day: 'dashboard', night: 'sky', switch: sw });
const at = (iso: string) => new Date(iso);
const shift = (d: Date, minutes: number) => new Date(d.getTime() + minutes * MIN);

describe('idle background values', () => {
  it('accepts one background, or a day and night pair switching by the sun or the clock', () => {
    for (const bg of [
      { source: 'dashboard' },
      { source: 'photos' },
      { source: 'sky' },
      pair(sun(30, -60)),
      { day: 'photos', night: 'sky', switch: { by: 'clock', from: '21:00', to: '06:30' } },
    ]) expect(idleBackgroundSchema.safeParse(bg).success).toBe(true);
  });

  it('refuses unknown backgrounds, offsets past half a day, bad times and an empty night', () => {
    for (const bg of [
      { source: 'video' },
      { source: 'photos', night: 'sky' },
      pair(sun(721, 0)),
      pair(sun(0, 12.5)),
      pair({ by: 'clock', from: '24:00', to: '06:00' } as IdleSwitch),
      pair({ by: 'clock', from: '21:00', to: '21:00' }),
    ]) expect(idleBackgroundSchema.safeParse(bg).success).toBe(false);
  });

  it('reads anything it does not know as the photo screensaver', () => {
    expect(parseIdleBackground(undefined)).toEqual({ source: 'photos' });
    expect(parseIdleBackground('calm')).toEqual({ source: 'photos' });
    expect(parseIdleBackground({ source: 'sky' })).toEqual({ source: 'sky' });
  });

  it('compares by meaning, whatever order the keys come back in', () => {
    const stored = JSON.parse('{"day":"photos","night":"sky","switch":{"by":"sun","dawnOffset":0,"duskOffset":0}}');
    expect(sameIdleBackground(stored, { day: 'photos', night: 'sky', switch: sun() })).toBe(true);
    expect(sameIdleBackground(stored, { day: 'photos', night: 'sky', switch: sun(0, 30) })).toBe(false);
    expect(sameIdleBackground({ source: 'sky' }, { source: 'photos' })).toBe(false);
  });

  it('swaps the dashboard for photos where there is no dashboard to show', () => {
    expect(withoutDashboard({ source: 'dashboard' })).toEqual({ source: 'photos' });
    const swapped = withoutDashboard(pair(sun()));
    expect(swapped).toEqual({ day: 'photos', night: 'sky', switch: sun() });
    expect(usesSource(swapped, 'dashboard')).toBe(false);
  });
});

describe('switching by the sun', () => {
  // Local noon at 45N 100W on the solstice is about 18:42 UTC, sunset about
  // 02:30 UTC and sunrise about 10:55 UTC the next day.
  const NOON = at('2026-06-21T18:42:00Z');
  const MIDNIGHT = at('2026-06-22T06:42:00Z');

  it('shows the day background by day and the night one after dark', () => {
    expect(idleSourceAt(pair(sun()), NOON, LAT, LON)).toBe('dashboard');
    expect(idleSourceAt(pair(sun()), MIDNIGHT, LAT, LON)).toBe('sky');
  });

  it('changes over at sunset and sunrise, not at some fixed hour', () => {
    const night = tonight(NOON, sun(), LAT, LON)!;
    expect(Math.abs(night.start.getTime() - at('2026-06-22T02:30:00Z').getTime())).toBeLessThan(15 * MIN);
    expect(Math.abs(night.end.getTime() - at('2026-06-22T10:55:00Z').getTime())).toBeLessThan(15 * MIN);
    expect(isNight(shift(night.start, -1), sun(), LAT, LON)).toBe(false);
    expect(isNight(shift(night.start, 1), sun(), LAT, LON)).toBe(true);
    expect(isNight(shift(night.end, -1), sun(), LAT, LON)).toBe(true);
    expect(isNight(shift(night.end, 1), sun(), LAT, LON)).toBe(false);
    // In winter the sun is down by the same clock time.
    expect(isNight(at('2026-06-22T00:30:00Z'), sun(), LAT, LON)).toBe(false);
    expect(isNight(at('2026-12-22T00:30:00Z'), sun(), LAT, LON)).toBe(true);
  });

  it('moves each edge by its offset, either way, in minutes or hours', () => {
    const plain = tonight(NOON, sun(), LAT, LON)!;
    for (const [dusk, dawn] of [[30, -60], [-90, 120], [-30, 45]] as const) {
      const moved = tonight(NOON, sun(dusk, dawn), LAT, LON)!;
      expect(moved.start.getTime() - plain.start.getTime()).toBe(dusk * MIN);
      expect(moved.end.getTime() - plain.end.getTime()).toBe(dawn * MIN);
      expect(isNight(shift(moved.start, -1), sun(dusk, dawn), LAT, LON)).toBe(false);
      expect(isNight(shift(moved.start, 1), sun(dusk, dawn), LAT, LON)).toBe(true);
      expect(isNight(shift(moved.end, -1), sun(dusk, dawn), LAT, LON)).toBe(true);
      expect(isNight(shift(moved.end, 1), sun(dusk, dawn), LAT, LON)).toBe(false);
    }
  });

  it('never shows the night when the offsets cross, rather than flickering', () => {
    // 64N near midsummer: about three hours from sunset to sunrise.
    const north = { lat: 64, lon: -150 };
    const short = tonight(at('2026-06-21T22:00:00Z'), sun(), north.lat, north.lon)!;
    expect(short.end.getTime() - short.start.getTime()).toBeLessThan(5 * 60 * MIN);
    const crossed = sun(120, -120);
    expect(tonight(at('2026-06-21T22:00:00Z'), crossed, north.lat, north.lon)).toBeNull();
    for (let t = shift(short.start, -60); t < shift(short.end, 60); t = shift(t, 10)) {
      expect(isNight(t, crossed, north.lat, north.lon)).toBe(false);
    }
  });

  it('goes by whether the sun is down where it never sets or never rises', () => {
    const polar = { lat: 78, lon: 15 };
    expect(isNight(at('2026-06-21T00:00:00Z'), sun(), polar.lat, polar.lon)).toBe(false);
    expect(isNight(at('2026-12-21T12:00:00Z'), sun(), polar.lat, polar.lon)).toBe(true);
  });
});

describe('switching at set times', () => {
  // Built on the local clock, so these hold in any time zone.
  const local = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m);

  it('switches at the chosen times across midnight', () => {
    const sw: IdleSwitch = { by: 'clock', from: '21:00', to: '06:30' };
    expect(isNight(local(30, 20, 59), sw, LAT, LON)).toBe(false);
    expect(isNight(local(30, 21, 0), sw, LAT, LON)).toBe(true);
    expect(isNight(local(31, 0, 0), sw, LAT, LON)).toBe(true);
    expect(isNight(local(31, 6, 29), sw, LAT, LON)).toBe(true);
    expect(isNight(local(31, 6, 30), sw, LAT, LON)).toBe(false);
    expect(tonight(local(31, 12), sw, LAT, LON)).toEqual({ start: local(31, 21), end: local(32, 6, 30) });
  });

  it('switches at the chosen times within one day', () => {
    const sw: IdleSwitch = { by: 'clock', from: '01:00', to: '05:00' };
    expect(isNight(local(31, 0, 59), sw, LAT, LON)).toBe(false);
    expect(isNight(local(31, 3), sw, LAT, LON)).toBe(true);
    expect(isNight(local(31, 5), sw, LAT, LON)).toBe(false);
    expect(isNight(local(31, 23), sw, LAT, LON)).toBe(false);
  });
});

describe('offsets that cross', () => {
  const north = { lat: 64, lon: -150 };
  const spring = at('2026-03-01T22:00:00Z');

  it('finds the first night in the coming year where they cross, near midsummer', () => {
    const crossed = firstCrossedNight(spring, sun(120, -120), north.lat, north.lon)!;
    expect(crossed).not.toBeNull();
    expect(crossed.getMonth()).toBeGreaterThanOrEqual(4);
    expect(crossed.getMonth()).toBeLessThanOrEqual(6);
  });

  it('passes offsets that leave a night all year, and set times', () => {
    expect(firstCrossedNight(spring, sun(30, -30), north.lat, north.lon)).toBeNull();
    expect(firstCrossedNight(spring, sun(120, -120), LAT, LON)).toBeNull();
    expect(firstCrossedNight(spring, { by: 'clock', from: '21:00', to: '06:30' }, LAT, LON)).toBeNull();
  });
});
