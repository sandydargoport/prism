import type { Figure } from './catalog';
import { project, toHorizontal, type View } from './sky';

/**
 * Teaching the constellations, one at a time: which figure to show next, and
 * the order its lines are drawn in.
 */

/** One stroke of a figure, drawn from `from` to `to` at step `depth`. */
export type Stroke = { from: number; to: number; depth: number }

/**
 * The order a figure is traced: outward from its brightest star, a step at a
 * time, so every line grows out of a star already drawn.
 *
 * Brightest first because that is how a constellation is found outside: spot
 * the star that stands out, then follow the shape from it. A figure in pieces
 * (Serpens is in two) starts each piece from its own brightest star.
 */
export function traceOrder(fig: Figure): Stroke[] {
  const count = fig.v.length / 3;
  const next: number[][] = Array.from({ length: count }, () => []);
  for (let i = 0; i < fig.e.length; i += 2) {
    const a = fig.e[i]!;
    const b = fig.e[i + 1]!;
    if (a === b) continue;
    next[a]!.push(b);
    next[b]!.push(a);
  }
  const depth = new Array<number>(count).fill(-1);
  const drawn = new Set<string>();
  const strokes: Stroke[] = [];
  const byBrightness = [...Array(count).keys()].sort((a, b) => fig.v[a * 3 + 2]! - fig.v[b * 3 + 2]!);
  for (const root of byBrightness) {
    if (depth[root] !== -1 || next[root]!.length === 0) continue;
    depth[root] = 0;
    const queue = [root];
    while (queue.length) {
      const at = queue.shift()!;
      for (const to of next[at]!) {
        const key = at < to ? `${at}-${to}` : `${to}-${at}`;
        if (drawn.has(key)) continue;
        drawn.add(key);
        // A line closing a loop joins two stars already reached; it is drawn
        // from the nearer one, alongside the rest of that step.
        strokes.push({ from: at, to, depth: depth[at]! });
        if (depth[to] === -1) {
          depth[to] = depth[at]! + 1;
          queue.push(to);
        }
      }
    }
  }
  return strokes;
}

/** A figure where it stands on screen now. */
export type Placement = {
  fig: Figure;
  /** Each star's position on screen. */
  points: { x: number; y: number }[];
  box: { left: number; top: number; right: number; bottom: number };
  /** Height of the screen it was placed on. */
  height: number;
}

/** Lowest any star of the figure may be, and how high its middle must be. */
const MIN_ALT = 3;
const MIN_MEAN_ALT = 12;
/** Room kept clear at the screen's edges, for the name as much as the lines. */
const EDGE = 24;

/** Where a figure is on screen, or null if it is not well placed to teach now. */
export function place(fig: Figure, lat: number, lst: number, view: View): Placement | null {
  const points: { x: number; y: number }[] = [];
  let altSum = 0;
  const box = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  for (let i = 0; i < fig.v.length; i += 3) {
    const h = toHorizontal(fig.v[i]!, fig.v[i + 1]!, lat, lst);
    if (h.alt < MIN_ALT) return null;
    altSum += h.alt;
    const p = project(h, view);
    points.push(p);
    box.left = Math.min(box.left, p.x);
    box.right = Math.max(box.right, p.x);
    box.top = Math.min(box.top, p.y);
    box.bottom = Math.max(box.bottom, p.y);
  }
  if (altSum / points.length < MIN_MEAN_ALT) return null;
  if (box.left < EDGE || box.top < EDGE || box.right > view.width - EDGE || box.bottom > view.height - EDGE) {
    return null;
  }
  // Too small to read the shape, or so large it fills the screen.
  const size = Math.max(box.right - box.left, box.bottom - box.top);
  if (size < view.height * 0.05 || size > view.width * 0.8) return null;
  return { fig, points, box, height: view.height };
}

type Rect = { left: number; top: number; right: number; bottom: number }

/** How much of a figure's box a widget covers, 0..1. */
function covered(box: Rect, rects: readonly Rect[]): number {
  const area = Math.max(1, (box.right - box.left) * (box.bottom - box.top));
  let hidden = 0;
  for (const r of rects) {
    const w = Math.min(box.right, r.right) - Math.max(box.left, r.left);
    const h = Math.min(box.bottom, r.bottom) - Math.max(box.top, r.top);
    if (w > 0 && h > 0) hidden += w * h;
  }
  return Math.min(1, hidden / area);
}

/** When each figure was last shown on this display, by id. */
export type TaughtHistory = Record<string, number>

/**
 * The next figure to teach: one that is up, on screen and not behind a widget,
 * preferring the one shown longest ago (never shown first), then the better
 * known, then the brighter. Over the nights of a season that works through
 * every figure the sky offers, and comes back round to each in turn.
 */
export function pickNext(
  figures: readonly Figure[], lat: number, lst: number, view: View,
  widgets: readonly Rect[], history: TaughtHistory,
): Placement | null {
  let best: Placement | null = null;
  let bestKey: number[] = [];
  for (const fig of figures) {
    const p = place(fig, lat, lst, view);
    if (!p || covered(p.box, widgets) > 0.15) continue;
    let brightest = Infinity;
    for (let i = 2; i < fig.v.length; i += 3) brightest = Math.min(brightest, fig.v[i]!);
    const key = [history[fig.id] ?? 0, fig.rank, brightest];
    if (!best || compare(key, bestKey) < 0) {
      best = p;
      bestKey = key;
    }
  }
  return best;
}

function compare(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return 0;
}
