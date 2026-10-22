import { aheadTarget, metres, pathAhead, routeAhead, stopsAhead, thinPath, type LngLat } from '../routeAhead';

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
    const out: LngLat[] = Array.from({ length: 11 }, (_, i) => [i * 0.0001, 0]);
    const back: LngLat[] = Array.from({ length: 10 }, (_, i) => [0.0009 - i * 0.0001, 0.00002]);
    const up: LngLat[] = Array.from({ length: 10 }, (_, i) => [0, 0.00002 + (i + 1) * 0.0001]);
    const loop = [...out, ...back, ...up];
    const stopAt: LngLat = [0, 0.001];
    // Heading west, the bus is on the way back: the line skips the trip out.
    const west = pathAhead(loop, [0.0005, 0.00001], stopAt, 270)!;
    expect(west.length).toBeLessThan(18);
    // Heading east, it is on the way out and has the whole loop ahead.
    const eastbound = pathAhead(loop, [0.0005, 0.00001], stopAt, 90)!;
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
