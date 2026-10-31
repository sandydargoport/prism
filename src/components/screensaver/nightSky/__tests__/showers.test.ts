import { activeShower, angleFromRadiant, meteorWait, showerNotice, SHOWERS } from '../showers';
import { localSiderealTime, toHorizontal } from '../sky';
import { eclipseDepth } from '../NightSky';

// A fictional household somewhere mid-latitude, west of Greenwich.
const LAT = 45;
const LON = -100;
const perseids = SHOWERS.find((s) => s.name === 'Perseids')!;
const etaAquariids = SHOWERS.find((s) => s.name === 'Eta Aquariids')!;

/** Hours through a night when a radiant is up (or not), at this location. */
function hoursWhere(day: string, up: boolean, ra: number, dec: number): Date[] {
  const out: Date[] = [];
  for (let h = 0; h < 24; h++) {
    const t = new Date(`${day}T00:00:00Z`);
    t.setUTCHours(h);
    const alt = toHorizontal(ra, dec, LAT, localSiderealTime(t, LON)).alt;
    if (up ? alt > 20 : alt < -5) out.push(t);
  }
  return out;
}

describe('meteor showers', () => {
  it('shows a shower on its peak night and not a week later', () => {
    // The Perseid radiant never sets at 45° north, so any hour of the night will do.
    const peakNight = new Date('2026-08-13T06:00:00Z');
    expect(activeShower(peakNight, LAT, LON)?.shower.name).toBe('Perseids');
    expect(activeShower(new Date('2026-08-20T06:00:00Z'), LAT, LON)).toBeNull();
  });

  it('gives no notice while the radiant is below the horizon', () => {
    const below = hoursWhere('2026-05-06', false, etaAquariids.ra, etaAquariids.dec);
    const above = hoursWhere('2026-05-06', true, etaAquariids.ra, etaAquariids.dec);
    expect(below.length).toBeGreaterThan(0);
    expect(above.length).toBeGreaterThan(0);
    for (const t of below) expect(activeShower(t, LAT, LON)).toBeNull();
    expect(activeShower(above[0]!, LAT, LON)?.shower.name).toBe('Eta Aquariids');
  });

  it('finds the Quadrantids across new year', () => {
    const t = hoursWhere('2026-01-03', true, 230, 49)[0]!;
    expect(activeShower(t, LAT, LON)?.shower.name).toBe('Quadrantids');
  });

  it('says what to expect, and when a bright moon will spoil it', () => {
    const radiant = { alt: 60, az: 30 };
    expect(showerNotice({ shower: perseids, radiant, moonWashesOut: false }))
      .toBe('Perseids peak tonight, up to 100 an hour');
    expect(showerNotice({ shower: perseids, radiant, moonWashesOut: true }))
      .toBe('Perseids peak tonight, up to 100 an hour, though the bright moon will hide the fainter ones');
  });

  it('sends shooting stars more often during a shower, the busier the shower the more', () => {
    const radiant = { alt: 60, az: 30 };
    const ordinaryNightMin = 120_000;
    const busy = meteorWait({ shower: perseids, radiant, moonWashesOut: false });
    const quiet = meteorWait({ shower: SHOWERS.find((s) => s.name === 'Ursids')!, radiant, moonWashesOut: false });
    expect(busy).toBeLessThan(quiet);
    expect(quiet).toBeLessThan(ordinaryNightMin);
  });

  it('sends a shower meteor straight away from the radiant', () => {
    expect(angleFromRadiant(150, 100, 100, 100)).toBeCloseTo(0);   // to the right
    expect(angleFromRadiant(100, 150, 100, 100)).toBeCloseTo(90);  // downward
    expect(angleFromRadiant(50, 100, 100, 100)).toBeCloseTo(180);  // to the left
  });
});

describe('the moon in a lunar eclipse', () => {
  const eclipse = {
    body: 'moon' as const,
    begin: new Date('2026-03-03T09:50:00Z'),
    peak: new Date('2026-03-03T11:33:00Z'),
    end: new Date('2026-03-03T13:17:00Z'),
    obscuration: 1,
  };

  it('is untouched outside the eclipse and fully copper at the peak of a total one', () => {
    expect(eclipseDepth(eclipse, new Date('2026-03-03T09:00:00Z'))).toBe(0);
    expect(eclipseDepth(eclipse, eclipse.peak)).toBeCloseTo(1);
    expect(eclipseDepth(eclipse, new Date('2026-03-03T14:00:00Z'))).toBe(0);
  });

  it('deepens toward the peak, and a partial one only so far', () => {
    const halfway = new Date((eclipse.begin.getTime() + eclipse.peak.getTime()) / 2);
    expect(eclipseDepth(eclipse, halfway)).toBeCloseTo(0.5);
    expect(eclipseDepth({ ...eclipse, obscuration: 0.4 }, eclipse.peak)).toBeCloseTo(0.4);
  });

  it('ignores a solar eclipse', () => {
    expect(eclipseDepth({ ...eclipse, body: 'sun' }, eclipse.peak)).toBe(0);
  });
});
