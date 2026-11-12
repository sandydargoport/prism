/**
 * Where the arc's labels go on a busy day (#910): pure, so it is tested
 * without a browser.
 *
 * Labels are placed in time order. Each tries the spot straight above its
 * bead, then nudged left or right by up to half its width, then one or two
 * tiers higher with a hairline leader down to the bead. A spot is refused if
 * it overlaps a label already placed or a fixed obstacle (the sun, the sunset
 * label), leaves the arc's box, sits nearer another bead than its own, or
 * needs a leader that passes close to another label. A label with no spot, and
 * any past the limit, folds into "+N"; the event is still a bead, one tap away.
 */

export interface Rect { left: number; top: number; width: number; height: number }

export interface LabelInput {
  id: string;
  /** The bead's centre. */
  x: number;
  y: number;
  /** The label's size. */
  width: number;
  height: number;
}

export interface PlacedLabel extends Rect {
  id: string;
  tier: number;
  /** Draw a hairline from the label down to its bead. */
  leader: boolean;
}

export interface Placement {
  placed: PlacedLabel[];
  folded: string[];
}

export const LABELS = {
  /** Space between a bead and its label. */
  gap: 14,
  /** Extra space between tiers. */
  tierGap: 6,
  tiers: 2,
  /** Clear space kept around every label. */
  pad: 6,
  /** A leader may not pass nearer another label than this. */
  leaderClear: 8,
  /** More labels than this reads as clutter, whatever fits. */
  max: 6,
} as const;

function overlaps(a: Rect, b: Rect, pad = 0): boolean {
  return a.left < b.left + b.width + pad && b.left < a.left + a.width + pad
    && a.top < b.top + b.height + pad && b.top < a.top + a.height + pad;
}

/** Does a vertical segment at x from y0 to y1 pass within `clear` of the rect? */
function segmentNear(x: number, y0: number, y1: number, r: Rect, clear: number): boolean {
  const top = Math.min(y0, y1), bottom = Math.max(y0, y1);
  return x > r.left - clear && x < r.left + r.width + clear && bottom > r.top - clear && top < r.top + r.height + clear;
}

export function placeLabels(
  items: LabelInput[],
  opts: {
    /** The arc's box: labels stay inside it horizontally, and not above its top. */
    width: number;
    top?: number;
    obstacles?: Rect[];
    /** The highest point of the path (smallest y) between two x values. */
    pathTop?: (x0: number, x1: number) => number;
    max?: number;
  },
): Placement {
  const { width, top: boxTop = -Infinity, obstacles = [], pathTop, max = LABELS.max } = opts;
  const placed: PlacedLabel[] = [];
  const folded: string[] = [];
  const beads = items.map((i) => i.x);

  for (const item of items) {
    if (placed.length >= max) { folded.push(item.id); continue; }
    const nudges = [0, -0.25, 0.25, -0.5, 0.5].map((f) => f * item.width);
    let spot: PlacedLabel | null = null;
    search:
    for (let tier = 0; tier <= LABELS.tiers; tier++) {
      for (const dx of nudges) {
        const left = item.x - item.width / 2 + dx;
        if (left < 0 || left + item.width > width) continue;
        const floor = Math.min(item.y, pathTop ? pathTop(left, left + item.width) : item.y);
        const top = floor - LABELS.gap - item.height - tier * (item.height + LABELS.tierGap);
        if (top < boxTop) continue;
        const rect = { left, top, width: item.width, height: item.height };
        if (placed.some((p) => overlaps(rect, p, LABELS.pad))) continue;
        if (obstacles.some((o) => overlaps(rect, o, LABELS.pad))) continue;
        // Read as belonging to the nearest bead, so it must be its own.
        const centre = left + item.width / 2;
        const own = Math.abs(centre - item.x);
        if (beads.some((bx, i) => items[i]!.id !== item.id && Math.abs(centre - bx) < own)) continue;
        const leader = tier > 0;
        if (leader) {
          const y0 = top + item.height, y1 = item.y;
          if (placed.some((p) => segmentNear(item.x, y0, y1, p, LABELS.leaderClear))) continue;
        }
        spot = { id: item.id, ...rect, tier, leader };
        break search;
      }
    }
    if (spot) placed.push(spot); else folded.push(item.id);
  }
  return { placed, folded };
}
