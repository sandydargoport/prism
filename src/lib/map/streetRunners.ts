/**
 * The kids who missed the bus, running after the chomper marker along the
 * streets on the map. Like the chasers in the arcade games they borrow from,
 * each picks a turn at every corner: toward the bus while chasing, away from
 * it for a few seconds after the bus catches them.
 *
 * The streets are the road lines in the map tiles already on screen, so this
 * needs no routing service. Pure: BusLiveMap supplies the lines and the clock.
 */

export type LngLat = [number, number];

export interface StreetGraph {
  nodes: LngLat[];
  /** Neighbours of each node, by index. */
  links: number[][];
}

export interface Runner {
  from: number;
  to: number;
  /** Metres travelled from `from` toward `to`. */
  along: number;
  mode: 'chase' | 'flee';
  fleeUntil: number;
}

/** How long a caught kid runs away. */
export const FLEE_MS = 5_000;
/** Ends of lines closer than this are one corner (tiles cut roads at their edges). */
const SNAP_M = 10;
const M_PER_DEG = 111_320;

/** Flat-earth metres, good enough across a few streets. */
export function metres(a: LngLat, b: LngLat): number {
  const dx = (b[0] - a[0]) * M_PER_DEG * Math.cos((a[1] * Math.PI) / 180);
  const dy = (b[1] - a[1]) * M_PER_DEG;
  return Math.hypot(dx, dy);
}

/** Map metres per screen pixel at a zoom and latitude (512 px tiles). */
export function metresPerPixel(zoom: number, lat: number): number {
  return (40_075_016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom);
}

/**
 * Street lines as a graph of corners and the points between them. Points
 * that coincide are merged, and a line that ends with nothing attached is
 * joined to the nearest point within SNAP_M, which heals the cuts at tile edges.
 */
export function buildStreetGraph(lines: LngLat[][]): StreetGraph {
  const nodes: LngLat[] = [];
  const links: Set<number>[] = [];
  const index = new Map<string, number>();
  const nodeAt = (p: LngLat) => {
    const key = `${p[0].toFixed(5)},${p[1].toFixed(5)}`;
    let i = index.get(key);
    if (i === undefined) {
      i = nodes.length;
      nodes.push(p);
      links.push(new Set());
      index.set(key, i);
    }
    return i;
  };
  for (const line of lines) {
    for (let k = 1; k < line.length; k++) {
      const a = nodeAt(line[k - 1]!);
      const b = nodeAt(line[k]!);
      if (a === b) continue;
      links[a]!.add(b);
      links[b]!.add(a);
    }
  }

  // A coarse grid finds the near points without comparing every pair.
  const cell = 0.0002;
  const grid = new Map<string, number[]>();
  const cellOf = (p: LngLat) => [Math.floor(p[0] / cell), Math.floor(p[1] / cell)] as const;
  nodes.forEach((p, i) => {
    const [x, y] = cellOf(p);
    const key = `${x},${y}`;
    (grid.get(key) ?? grid.set(key, []).get(key)!).push(i);
  });
  nodes.forEach((p, i) => {
    if (links[i]!.size !== 1) return;
    const [x, y] = cellOf(p);
    let best = -1;
    let bestM = SNAP_M;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const j of grid.get(`${x + dx},${y + dy}`) ?? []) {
          if (j === i || links[i]!.has(j)) continue;
          const m = metres(p, nodes[j]!);
          if (m < bestM) { bestM = m; best = j; }
        }
      }
    }
    if (best >= 0) {
      links[i]!.add(best);
      links[best]!.add(i);
    }
  });

  return { nodes, links: links.map((s) => [...s]) };
}

export function runnerPosition(g: StreetGraph, r: Runner): LngLat {
  const a = g.nodes[r.from]!;
  const b = g.nodes[r.to]!;
  const len = metres(a, b);
  const t = len === 0 ? 1 : Math.min(1, r.along / len);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** The node nearest `p`, or -1 for an empty graph. */
export function nearestNode(g: StreetGraph, p: LngLat): number {
  let best = -1;
  let bestM = Infinity;
  g.nodes.forEach((n, i) => {
    if (g.links[i]!.length === 0) return;
    const m = metres(p, n);
    if (m < bestM) { bestM = m; best = i; }
  });
  return best;
}

/**
 * A new kid on a street corner between `minM` and `maxM` from the bus, so
 * they start in sight but not on top of it. Null when there are no streets.
 */
export function spawnRunner(
  g: StreetGraph, bus: LngLat, minM: number, maxM: number, rand: () => number,
): Runner | null {
  const linked = g.nodes.map((_, i) => i).filter((i) => g.links[i]!.length > 0);
  if (linked.length === 0) return null;
  const inRing = linked.filter((i) => {
    const m = metres(bus, g.nodes[i]!);
    return m >= minM && m <= maxM;
  });
  const pool = inRing.length > 0 ? inRing : linked;
  const from = pool[Math.floor(rand() * pool.length)]!;
  const next = g.links[from]!;
  return { from, to: next[Math.floor(rand() * next.length)]!, along: 0, mode: 'chase', fleeUntil: 0 };
}

/**
 * The next street from a corner: not straight back unless it is a dead end,
 * then the one that ends nearest the bus (chasing) or furthest from it
 * (fleeing). A little randomness keeps the kids from bunching into a queue.
 */
function nextNode(g: StreetGraph, at: number, cameFrom: number, bus: LngLat, flee: boolean, rand: () => number): number {
  const options = g.links[at]!.filter((n) => n !== cameFrom);
  if (options.length === 0) return cameFrom;
  let best = options[0]!;
  let bestScore = -Infinity;
  for (const n of options) {
    const away = metres(g.nodes[n]!, bus);
    const score = (flee ? away : -away) + rand() * 25;
    if (score > bestScore) { bestScore = score; best = n; }
  }
  return best;
}

/** Moves a kid `distance` metres along the streets, turning at corners. */
export function stepRunner(
  g: StreetGraph, r: Runner, distance: number, bus: LngLat, now: number, rand: () => number,
): Runner {
  let { from, to, along } = r;
  const mode = r.mode === 'flee' && now >= r.fleeUntil ? 'chase' : r.mode;
  along += distance;
  // A few corners at most per step; a stretch of very short pieces is rare.
  for (let guard = 0; guard < 8; guard++) {
    const len = metres(g.nodes[from]!, g.nodes[to]!);
    if (along < len) break;
    along -= len;
    const next = nextNode(g, to, from, bus, mode === 'flee', rand);
    from = to;
    to = next;
  }
  return { from, to, along, mode, fleeUntil: r.fleeUntil };
}

/** Caught by the bus: turn and run, the way to leave at once. */
export function scare(g: StreetGraph, r: Runner, now: number): Runner {
  if (r.mode === 'flee') return r;
  const len = metres(g.nodes[r.from]!, g.nodes[r.to]!);
  return { from: r.to, to: r.from, along: Math.max(0, len - r.along), mode: 'flee', fleeUntil: now + FLEE_MS };
}

/** The same kid on a rebuilt graph (the map moved): from the nearest corner. */
export function moveToGraph(g: StreetGraph, r: Runner, at: LngLat, rand: () => number): Runner | null {
  const from = nearestNode(g, at);
  if (from < 0) return null;
  const next = g.links[from]!;
  return { ...r, from, to: next[Math.floor(rand() * next.length)]!, along: 0 };
}
