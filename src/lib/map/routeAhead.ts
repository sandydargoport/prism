/**
 * The road still ahead of the bus, drawn dashed so it never passes for a
 * position the bus reported.
 *
 * Bus routes repeat day to day, so the best guess at the streets ahead is the
 * last trip's own trace: from the point nearest the bus to the point nearest
 * where it is headed. With no earlier trip, or with the bus well off that
 * path (a detour, a new route), it falls back to straight lines through the
 * stops still to come. Pure, so it can be tested without a map.
 *
 * A run can use the same street twice (the leg out of the depot and the
 * route proper, say), so the bus is matched only to parts of the path that
 * head the same way it does. Mornings and afternoons are separate routes, so
 * each follows its own earlier trips.
 */

export type LngLat = [number, number];

/** Further than this from the usual path, the bus is not on it today. */
export const OFF_PATH_M = 150;
/** A path piece turned further than this from the bus's heading is another pass. */
const SAME_WAY_DEG = 90;
/** Points closer than this add nothing to a line at map zoom. */
const THIN_M = 15;

interface AheadStop {
  key: string;
  lat: number;
  lng: number;
  passed: boolean;
}

/** Flat-earth metres, good enough across a town. */
export function metres(a: LngLat, b: LngLat): number {
  const dx = (b[0] - a[0]) * 111_320 * Math.cos((a[1] * Math.PI) / 180);
  const dy = (b[1] - a[1]) * 111_320;
  return Math.hypot(dx, dy);
}

/** Drops points within THIN_M of the last one kept; always keeps the end. */
export function thinPath(points: LngLat[]): LngLat[] {
  if (points.length <= 2) return points;
  const out: LngLat[] = [points[0]!];
  for (let i = 1; i < points.length - 1; i++) {
    if (metres(out[out.length - 1]!, points[i]!) >= THIN_M) out.push(points[i]!);
  }
  out.push(points[points.length - 1]!);
  return out;
}

/** Compass bearing from a to b, degrees. */
function bearing(a: LngLat, b: LngLat): number {
  const dx = (b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180);
  const dy = b[1] - a[1];
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

function sameWay(path: LngLat[], i: number, heading: number): boolean {
  const a = path[Math.max(0, i - 1)]!;
  const b = path[Math.min(path.length - 1, i + 1)]!;
  if (a === b) return true;
  const off = Math.abs(((bearing(a, b) - heading + 540) % 360) - 180);
  return off <= SAME_WAY_DEG;
}

/**
 * The index of the point nearest `p` at or after `from`, and how far it is;
 * with a heading, only points where the path runs that way.
 */
function nearest(path: LngLat[], p: LngLat, from = 0, heading: number | null = null): { index: number; m: number } {
  let index = -1;
  let m = Infinity;
  for (let i = from; i < path.length; i++) {
    if (heading !== null && !sameWay(path, i, heading)) continue;
    const d = metres(path[i]!, p);
    if (d < m) { m = d; index = i; }
  }
  return { index, m };
}

/**
 * Where the dashed line ends: our stop until the bus has been there, then the
 * end of the route (the school in the morning).
 */
export function aheadTarget(stops: AheadStop[], riderStopKey: string | null): AheadStop | null {
  const rider = stops.find((s) => s.key === riderStopKey && !s.passed);
  if (rider) return rider;
  const last = stops[stops.length - 1];
  return last && !last.passed ? last : null;
}

/**
 * The line from the bus to `target` along the usual path, or null when the
 * bus or the target is not near it, or the target lies behind the bus on it.
 */
export function pathAhead(
  usual: LngLat[], bus: LngLat, target: LngLat, heading: number | null = null,
): LngLat[] | null {
  if (usual.length < 2) return null;
  const from = nearest(usual, bus, 0, heading);
  if (from.m > OFF_PATH_M) return null;
  const to = nearest(usual, target, from.index);
  if (to.m > OFF_PATH_M || to.index <= from.index) return null;
  return [bus, ...usual.slice(from.index + 1, to.index + 1), target];
}

/** Straight lines from the bus through the stops still to come, up to `target`. */
export function stopsAhead(stops: AheadStop[], bus: LngLat, target: AheadStop): LngLat[] {
  const end = stops.indexOf(target);
  const between = stops.slice(0, end + 1).filter((s) => !s.passed);
  return [bus, ...between.map((s): LngLat => [s.lng, s.lat])];
}

/** The road ahead to draw, or null when there is nowhere left to go. */
export function routeAhead(
  usual: LngLat[] | null,
  stops: AheadStop[],
  riderStopKey: string | null,
  bus: LngLat,
  heading: number | null = null,
): LngLat[] | null {
  const target = aheadTarget(stops, riderStopKey);
  if (!target) return null;
  return (usual && pathAhead(usual, bus, [target.lng, target.lat], heading)) ?? stopsAhead(stops, bus, target);
}

/**
 * The point `m` metres along `line` and the way the line runs there, so a
 * guess between real positions follows the road round a corner instead of
 * running straight on. Stops at the end of the line.
 */
export function pointAlong(line: LngLat[], m: number): { point: LngLat; heading: number } {
  let left = Math.max(0, m);
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!;
    const b = line[i]!;
    const len = metres(a, b);
    if (len === 0) continue;
    if (left <= len) {
      const t = left / len;
      return { point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], heading: bearing(a, b) };
    }
    left -= len;
  }
  const n = line.length;
  return { point: line[n - 1]!, heading: n >= 2 ? bearing(line[n - 2]!, line[n - 1]!) : 0 };
}
