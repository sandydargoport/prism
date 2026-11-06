/**
 * Where a photo's subject is (#956), from a small RGBA copy of it.
 *
 * Two maps, each cheap on a ~64px image:
 *  - saliency: how far each pixel stands out from the photo's average colour,
 *    plus its saturation (a subject usually differs from a sky, wall or lawn);
 *  - skin tone: pixels in the usual range of skin, weighted up, since people
 *    are most often what a family photo is of.
 * The focal point is the weighted centre of the strongest pixels. A flat
 * photo, with nothing standing out, gives the centre.
 *
 * Runs in the browser only; no photo leaves the install for this.
 */
export interface FocalPoint { x: number; y: number }

export const CENTRE: FocalPoint = { x: 0.5, y: 0.5 };

/** Side of the small copy the browser draws before calling focalPoint. */
export const FOCAL_SAMPLE_PX = 64;

const SKIN_WEIGHT = 1.5;
/** Share of pixels, strongest first, that decide the centre. */
const TOP_SHARE = 0.1;
/** Below this, nothing stands out: the centre. */
const FLAT = 12;

/** Skin in RGB, a classic rule of thumb (Kovac et al.). */
function isSkin(r: number, g: number, b: number): boolean {
  return r > 95 && g > 40 && b > 20
    && Math.max(r, g, b) - Math.min(r, g, b) > 15
    && Math.abs(r - g) > 15 && r > g && r > b;
}

export function focalPoint(rgba: Uint8ClampedArray | number[], width: number, height: number): FocalPoint {
  const n = width * height;
  if (n === 0 || rgba.length < n * 4) return CENTRE;
  let mr = 0; let mg = 0; let mb = 0;
  for (let i = 0; i < n; i++) { mr += rgba[i * 4]!; mg += rgba[i * 4 + 1]!; mb += rgba[i * 4 + 2]!; }
  mr /= n; mg /= n; mb /= n;

  const score = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4]!; const g = rgba[i * 4 + 1]!; const b = rgba[i * 4 + 2]!;
    const distance = Math.sqrt((r - mr) ** 2 + (g - mg) ** 2 + (b - mb) ** 2);
    const saturation = Math.max(r, g, b) - Math.min(r, g, b);
    const s = distance + 0.25 * saturation;
    score[i] = isSkin(r, g, b) ? s * SKIN_WEIGHT + 20 : s;
  }

  const sorted = Array.from(score).sort((a, b) => b - a);
  const hi = sorted[0]!; const lo = sorted[n - 1]!;
  if (hi - lo < FLAT) return CENTRE;
  // The strongest tenth, but never below halfway up the range: a subject
  // smaller than a tenth of the photo must not pull in the flat ground.
  const cutoff = Math.max(sorted[Math.max(0, Math.floor(n * TOP_SHARE) - 1)]!, lo + 0.5 * (hi - lo));

  let sx = 0; let sy = 0; let sw = 0;
  for (let i = 0; i < n; i++) {
    if (score[i]! < cutoff) continue;
    const w = score[i]!;
    sx += ((i % width) + 0.5) * w;
    sy += (Math.floor(i / width) + 0.5) * w;
    sw += w;
  }
  if (sw === 0) return CENTRE;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return { x: clamp(sx / sw / width), y: clamp(sy / sw / height) };
}

/** A stored focal point, or the centre when there is none. */
export function focalOf(photo: { focalX?: number | null; focalY?: number | null }): FocalPoint {
  return photo.focalX == null || photo.focalY == null ? CENTRE : { x: photo.focalX, y: photo.focalY };
}

/** Whether a value can be stored as a focal coordinate. */
export function isFocalCoordinate(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
}
