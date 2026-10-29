import { aheadTarget, combineTraces, metres, pathAhead, pointAlong, routeAhead, stopsAhead, thinPath, type LngLat } from '../routeAhead';

// An L-shaped usual path at the equator, a point every ~11 m: east 0.003°, then north.
const east: LngLat[] = Array.from({ length: 31 }, (_, i) => [i * 0.0001, 0]);
const north: LngLat[] = Array.from({ length: 30 }, (_, i) => [0.003, (i + 1) * 0.0001]);
const usual = [...east, ...north];

const stop = (key: string, lng: number, lat: number, passed = false) => ({ key, lng, lat, passed });
const stops = [stop('a', 0, 0, true), stop('mine', 0.003, 0.002), stop('school', 0.003, 0.003)];

describe('thinPath', () => {
  it('keeps the ends and drops points closer than a few metres', () => {
    const thin = thinPath(usual);
    expect(thin[0]).toEqual(usual[0]);
    expect(thin.at(-1)).toEqual(usual.at(-1));
    expect(thin.length).toBeLessThan(usual.length);
  });
});

describe('aheadTarget', () => {
  it('heads for our stop, then the end of the route', () => {
    expect(aheadTarget(stops, 'mine')?.key).toBe('mine');
    expect(aheadTarget(stops.map((s) => (s.key === 'mine' ? { ...s, passed: true } : s)), 'mine')?.key).toBe('school');
    expect(aheadTarget(stops.map((s) => ({ ...s, passed: true })), 'mine')).toBeNull();
  });
});

describe('pathAhead', () => {
  it('follows the usual path round the corner from the bus to the stop', () => {
    const line = pathAhead(usual, [0.001, 0.00005], [0.003, 0.002])!;
    expect(line[0]).toEqual([0.001, 0.00005]);
    expect(line.at(-1)).toEqual([0.003, 0.002]);
    expect(line).toContainEqual([0.003, 0]); // the corner
  });

  it('matches the pass that heads the way the bus does', () => {
    // Out east along one street, back west along it, then north to the stop.
    // Points are a step (~11 m) apart; the way back runs a fifth of a step north.
    const step = 1e-4;
    const out: LngLat[] = Array.from({ length: 11 }, (_, i) => [i * step, 0]);
    const back: LngLat[] = Array.from({ length: 10 }, (_, i) => [(9 - i) * step, step / 5]);
    const up: LngLat[] = Array.from({ length: 10 }, (_, i) => [0, step / 5 + (i + 1) * step]);
    const loop = [...out, ...back, ...up];
    const stopAt: LngLat = [0, 10 * step];
    const bus: LngLat = [5 * step, step / 10];
    // Heading west, the bus is on the way back: the line skips the trip out.
    const west = pathAhead(loop, bus, stopAt, 270)!;
    expect(west.length).toBeLessThan(18);
    // Heading east, it is on the way out and has the whole loop ahead.
    const eastbound = pathAhead(loop, bus, stopAt, 90)!;
    expect(eastbound.length).toBeGreaterThan(west.length);
  });

  it('gives up when the bus is off the usual path or past the target', () => {
    expect(pathAhead(usual, [0.001, 0.005], [0.003, 0.002])).toBeNull();
    expect(pathAhead(usual, [0.003, 0.0025], [0.003, 0.002])).toBeNull();
  });
});

describe('routeAhead', () => {
  it('falls back to straight lines through the stops still to come', () => {
    const line = routeAhead(null, stops, 'mine', [0.001, 0])!;
    expect(line).toEqual(stopsAhead(stops, [0.001, 0], stops[1]!));
    expect(line).toEqual([[0.001, 0], [0.003, 0.002]]);
    expect(metres(line[0]!, line[1]!)).toBeGreaterThan(200);
  });

  it('uses the usual path when the bus is on it', () => {
    expect(routeAhead(usual, stops, 'mine', [0.001, 0])!.length).toBeGreaterThan(10);
  });
});

describe('pointAlong', () => {
  const corner: LngLat[] = [[0, 0], [0.001, 0], [0.001, 0.001]]; // east ~111 m, then north
  it('walks the line and turns with it', () => {
    const before = pointAlong(corner, 50);
    expect(before.heading).toBeCloseTo(90, 0);
    expect(metres(before.point, [0, 0])).toBeCloseTo(50, 0);
    const after = pointAlong(corner, 161);
    expect(after.heading).toBeCloseTo(0, 0);
    expect(metres(after.point, [0.001, 0])).toBeCloseTo(161 - metres([0, 0], [0.001, 0]), 0);
  });
  it('stops at the end', () => {
    expect(pointAlong(corner, 10_000).point).toEqual([0.001, 0.001]);
  });
});

describe('combineTraces', () => {
  // Metres to degrees at the equator, where a degree is the same both ways.
  const M = 1 / 111_320;
  const xy = (x: number, y: number): LngLat => [x * M, y * M];
  // A road east 200 m, then north 200 m; `s` is the distance along it.
  const onRoad = (s: number): LngLat => (s <= 200 ? xy(s, 0) : xy(200, s - 200));
  const sampled = (offset: number, every = 60) =>
    Array.from({ length: Math.floor((400 - offset) / every) + 1 }, (_, i) => onRoad(offset + i * every));
  const corner = xy(200, 0);

  /** How close a drawn line comes to `p`, in metres. */
  const gap = (line: LngLat[], p: LngLat) => {
    let best = Infinity;
    for (let i = 1; i < line.length; i++) {
      const [a, b] = [line[i - 1]!, line[i]!];
      for (let t = 0; t <= 1; t += 0.01) best = Math.min(best, metres([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], p));
    }
    return best;
  };

  it('fills in a corner that every single trip cuts', () => {
    // A fix every 60 m, landing in a different place each day, none within 10 m of the corner.
    const trips = [0, 10, 30, 40, 50, 55].map((o) => sampled(o));
    const single = Math.min(...trips.map((t) => gap(t, corner)));
    const pooled = combineTraces(trips);
    expect(gap(pooled, corner)).toBeLessThan(single);
    expect(gap(pooled, corner)).toBeLessThan(8);
  });

  it('keeps a street driven out and back in order', () => {
    const outAndBack = (o: number) => [
      ...Array.from({ length: 15 }, (_, i) => xy(o + i * 20, 0)),
      ...Array.from({ length: 15 }, (_, i) => xy(300 - o - i * 20, 0)),
    ];
    const pooled = combineTraces([outAndBack(0), outAndBack(7), outAndBack(13)]);
    const x = (p: LngLat) => p[0] / M;
    expect(x(pooled[0]!)).toBeLessThan(30);
    expect(Math.max(...pooled.map(x))).toBeGreaterThan(270);
    expect(x(pooled.at(-1)!)).toBeLessThan(30);
  });

  it("leaves out one day's detour", () => {
    const usual = [sampled(0, 20), sampled(10, 20)];
    // A sparser trip that swung 100 m off the road halfway along the first leg.
    const detour = sampled(5, 40).map((p, i) => (i === 2 ? xy(p[0] / M, 100) : p));
    const pooled = combineTraces([...usual, detour]);
    expect(Math.max(...pooled.map((p) => p[1] / M).filter((_, i) => pooled[i]![0] / M < 190))).toBeLessThan(5);
  });

  it('is empty with nothing to go on', () => {
    expect(combineTraces([])).toEqual([]);
    expect(combineTraces([[xy(0, 0)]])).toEqual([]);
  });
});

