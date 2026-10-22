import { MAX_BUS_MPS, checkFixes } from '../busFixCheck';

// One fix every 10 s heading north at ~10 m/s, all invented.
const DEG_PER_M = 1 / 111_320;
const fix = (i: number, metres: number, extra: Partial<{ speed: number | null; moving: boolean | null; doorOpen: boolean | null }> = {}) => ({
  ts: new Date(Date.UTC(2030, 0, 2, 8, 0, i * 10)).toISOString(),
  lat: 40 + metres * DEG_PER_M,
  lng: -105,
  speed: null as number | null,
  moving: null as boolean | null,
  doorOpen: null as boolean | null,
  ...extra,
});

describe('checkFixes', () => {
  it('replaces an impossible speed with the one the positions imply', () => {
    const out = checkFixes([fix(0, 0, { speed: 100 }), fix(1, 100, { speed: 100 })]);
    expect(out[0]!.speed).toBeNull();
    expect(out[1]!.speed).toBeCloseTo(10, 0);
    expect(out[1]!.speed!).toBeLessThan(MAX_BUS_MPS);
  });

  it('keeps a believable speed as reported', () => {
    expect(checkFixes([fix(0, 0), fix(1, 100, { speed: 8 })])[1]!.speed).toBe(8);
  });

  it('drops a door flag that never changes', () => {
    const stuck = Array.from({ length: 12 }, (_, i) => fix(i, i === 5 || i === 6 ? 500 : i * 100, { doorOpen: true }));
    expect(checkFixes(stuck).every((f) => f.doorOpen === null)).toBe(true);
  });

  it('drops an open door while the bus is under way, keeps it when stopped', () => {
    const fixes = [
      fix(0, 0, { doorOpen: false }), fix(1, 100, { doorOpen: true }), fix(2, 200, { doorOpen: false }),
      fix(3, 200, { doorOpen: true }), fix(4, 200, { doorOpen: false }),
    ];
    const out = checkFixes(fixes);
    expect(out[1]!.doorOpen).toBeNull();
    expect(out[3]!.doorOpen).toBe(true);
  });

  it('drops "not moving" when the positions show the bus under way', () => {
    const out = checkFixes([fix(0, 0), fix(1, 100, { moving: false }), fix(2, 200)]);
    expect(out[1]!.moving).toBeNull();
  });
});
