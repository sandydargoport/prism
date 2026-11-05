/**
 * How a photo is framed on the screen (#957).
 *
 * The photo covers the screen (like CSS background-size: cover), so when its
 * shape differs from the screen's, part of it is cropped. Instead of always
 * cropping around the centre, this picks the crop that puts the photo's
 * subject (its focal point, #956) where the widgets are not. When no crop
 * keeps the subject clear, it takes the one that brings it nearest to a clear
 * spot. Among clear crops it prefers the one closest to the centred crop, so
 * a photo moves no more than it has to.
 *
 * It also gives where the subject lands on screen, which the slow zoom (#955)
 * anchors on.
 */
import type { FocalPoint } from './focalPoint';

export interface Rect { left: number; top: number; width: number; height: number }
export interface Frame {
  /** CSS background-position, in percent of the overflow. */
  position: { x: number; y: number };
  /** Where the subject lands, as fractions of the screen. */
  origin: FocalPoint;
}

export const CENTRED: Frame = { position: { x: 50, y: 50 }, origin: { x: 0.5, y: 0.5 } };

/** Candidate spots across the screen, as fractions. */
const STEPS = 9;
/** Padding around a widget that still counts as covered, in px. */
const MARGIN = 24;

/** Hidden under a widget, or off the screen altogether. */
function hidden(x: number, y: number, W: number, H: number, rects: readonly Rect[]): boolean {
  if (x < 0 || y < 0 || x > W || y > H) return true;
  return rects.some((r) => x >= r.left - MARGIN && x <= r.left + r.width + MARGIN && y >= r.top - MARGIN && y <= r.top + r.height + MARGIN);
}

export function photoFrame(opts: {
  /** The photo's width over its height. */
  aspect: number;
  screen: { width: number; height: number };
  covered: readonly Rect[];
  focal: FocalPoint;
}): Frame {
  const { aspect, screen, focal } = opts;
  const W = screen.width; const H = screen.height;
  if (!(aspect > 0) || W <= 0 || H <= 0) return CENTRED;
  // Cover: scale the photo so it fills the screen.
  const sw = Math.max(W, H * aspect);
  const sh = sw / aspect;
  const ox = sw - W; const oy = sh - H;
  const fx = focal.x * sw; const fy = focal.y * sh;

  const place = (offX: number, offY: number) => ({ x: fx - offX, y: fy - offY, offX, offY });
  const clamp = (v: number, max: number) => Math.min(max, Math.max(0, v));
  const centred = place(ox / 2, oy / 2);

  type Pick = { x: number; y: number; offX: number; offY: number; clear: boolean; cost: number };
  const clearSpots: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < STEPS; i++) for (let j = 0; j < STEPS; j++) {
    const x = ((i + 0.5) / STEPS) * W; const y = ((j + 0.5) / STEPS) * H;
    if (!hidden(x, y, W, H, opts.covered)) clearSpots.push({ x, y });
  }

  let best: Pick | null = null;
  const consider = (tx: number, ty: number) => {
    const p = place(clamp(fx - tx, ox), clamp(fy - ty, oy));
    const clear = !hidden(p.x, p.y, W, H, opts.covered);
    const cost = clear
      ? Math.hypot(p.offX - ox / 2, p.offY - oy / 2)
      : Math.min(...clearSpots.map((s) => Math.hypot(s.x - p.x, s.y - p.y)), Infinity);
    const cand: Pick = { ...p, clear, cost };
    if (!best || (cand.clear && !best.clear) || (cand.clear === best.clear && cand.cost < best.cost)) best = cand;
  };
  consider(centred.x, centred.y);
  for (const s of clearSpots) consider(s.x, s.y);
  const b = best as Pick | null;
  if (!b) return CENTRED;

  return {
    position: { x: ox > 0 ? (b.offX / ox) * 100 : 50, y: oy > 0 ? (b.offY / oy) * 100 : 50 },
    origin: { x: b.x / W, y: b.y / H },
  };
}
