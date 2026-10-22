import {
  FLEE_MS, buildStreetGraph, metres, runnerPosition, scare, spawnRunner, stepRunner,
  type LngLat, type Runner,
} from '../streetRunners';

// A plus-shaped crossing of two streets, about 111 m per arm, at the equator
// so a degree is the same both ways.
const c: LngLat = [0, 0];
const n: LngLat = [0, 0.001];
const e: LngLat = [0.001, 0];
const s: LngLat = [0, -0.001];
const w: LngLat = [-0.001, 0];
const plus = buildStreetGraph([[n, c, s], [w, c, e]]);
const idx = (p: LngLat) => plus.nodes.findIndex((q) => q[0] === p[0] && q[1] === p[1]);
const noJitter = () => 0;

describe('buildStreetGraph', () => {
  it('joins lines that share a point', () => {
    expect(plus.nodes).toHaveLength(5);
    expect(plus.links[idx(c)]).toHaveLength(4);
  });

  it('heals a road cut at a tile edge', () => {
    const g = buildStreetGraph([[[0, 0], [0.001, 0]], [[0.00105, 0], [0.002, 0]]]);
    const end = g.nodes.findIndex((p) => p[0] === 0.001);
    expect(g.links[end]).toHaveLength(2);
  });
});

describe('runners', () => {
  const runner = (from: LngLat, to: LngLat, mode: Runner['mode'] = 'chase'): Runner =>
    ({ from: idx(from), to: idx(to), along: 0, mode, fleeUntil: mode === 'flee' ? FLEE_MS : 0 });

  it('turns toward the bus at a corner', () => {
    const r = stepRunner(plus, runner(n, c), 130, e, 0, noJitter);
    expect(plus.nodes[r.to]).toEqual(e);
    expect(metres(runnerPosition(plus, r), c)).toBeCloseTo(19, 0);
  });

  it('turns away while fleeing, and chases again when the time is up', () => {
    expect(plus.nodes[stepRunner(plus, runner(n, c, 'flee'), 130, e, 0, noJitter).to]).toEqual(w);
    expect(stepRunner(plus, runner(n, c, 'flee'), 1, e, FLEE_MS, noJitter).mode).toBe('chase');
  });

  it('turns round on the spot when caught', () => {
    const r = { ...runner(n, c), along: 30 };
    const fled = scare(plus, r, 0);
    expect(fled.mode).toBe('flee');
    expect(metres(runnerPosition(plus, fled), runnerPosition(plus, r))).toBeLessThan(0.5);
    expect(plus.nodes[fled.to]).toEqual(n);
  });

  it('starts kids in a ring around the bus', () => {
    const r = spawnRunner(plus, c, 100, 150, () => 0.5)!;
    expect(metres(plus.nodes[r.from]!, c)).toBeGreaterThanOrEqual(100);
    expect(spawnRunner(buildStreetGraph([]), c, 100, 150, Math.random)).toBeNull();
  });
});
