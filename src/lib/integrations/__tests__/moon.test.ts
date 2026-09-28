import { getMoonData } from '../moon';

// Chicago, and its local day of 1 May 2026 (CDT, UTC-5).
const LAT = 41.88;
const LON = -87.63;
const DAY_START = new Date('2026-05-01T05:00:00Z');
const DAY_END = new Date('2026-05-02T05:00:00Z');

describe('getMoonData', () => {
  it("returns moonrise and moonset inside the location's day", () => {
    const moon = getMoonData(LAT, LON, new Date('2026-05-01T15:00:00Z'), DAY_START);
    for (const t of [moon.moonrise, moon.moonset]) {
      if (!t) continue; // a day can have no rise or no set
      expect(t.getTime()).toBeGreaterThanOrEqual(DAY_START.getTime());
      expect(t.getTime()).toBeLessThan(DAY_END.getTime());
    }
    expect(moon.moonrise ?? moon.moonset).toBeDefined();
  });

  it('keeps phase and illumination for the given instant', () => {
    const now = new Date('2026-05-01T15:00:00Z');
    const a = getMoonData(LAT, LON, now, DAY_START);
    const b = getMoonData(LAT, LON, now);
    expect(a.moonPhase).toBe(b.moonPhase);
    expect(a.moonIllumination).toBe(b.moonIllumination);
  });
});
