import { eclipseForDay } from '../eclipse';

// A fictional household somewhere mid-latitude, west of Greenwich, and the
// instant its local day starts (midnight at UTC-5 in summer, UTC-6 in winter).
const LAT = 45;
const LON = -100;
const day = (date: string, utcOffset: number) => new Date(`${date}T0${utcOffset}:00:00Z`);

describe('eclipses seen from here', () => {
  it('finds a partial solar eclipse while the sun is up', () => {
    // 8 April 2024: total along a path to the south-east, partial here.
    const e = eclipseForDay(LAT, LON, day('2024-04-08', 5))!;
    expect(e).toMatchObject({ body: 'sun', kind: 'partial' });
    expect(e.peak.toISOString()).toMatch(/^2024-04-08T18:5/);
    expect(e.obscuration).toBeGreaterThan(0.5);
    expect(e.obscuration).toBeLessThan(0.75);
    expect(e.begin.getTime()).toBeLessThan(e.peak.getTime());
    expect(e.end.getTime()).toBeGreaterThan(e.peak.getTime());
  });

  it('finds a total lunar eclipse while the moon is up, on the local day it happens', () => {
    // 14 March 2025, peak 06:59 UTC: just before 2 a.m. local, so the 14th.
    expect(eclipseForDay(LAT, LON, day('2025-03-14', 5))).toMatchObject({ body: 'moon', kind: 'total' });
    expect(eclipseForDay(LAT, LON, day('2025-03-13', 5))).toBeUndefined();
  });

  it('leaves out an eclipse that cannot be seen from here', () => {
    // 12 August 2026: total over Spain and Iceland, nothing in this sky.
    expect(eclipseForDay(LAT, LON, day('2026-08-12', 5))).toBeUndefined();
    // 7 September 2025: total lunar, with the moon below this horizon.
    expect(eclipseForDay(LAT, LON, day('2025-09-07', 5))).toBeUndefined();
  });

  it('leaves out a penumbral lunar eclipse, which nobody would notice', () => {
    // 25 March 2024: penumbral only, with the moon up here.
    expect(eclipseForDay(LAT, LON, day('2024-03-25', 5))).toBeUndefined();
  });

  it('has none on an ordinary day', () => {
    expect(eclipseForDay(LAT, LON, day('2026-10-26', 5))).toBeUndefined();
  });
});
