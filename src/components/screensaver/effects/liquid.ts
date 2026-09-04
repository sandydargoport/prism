import type { EffectFrame, ScreensaverEffect } from './types';

/**
 * A waterline crossing the widget: it fills to arrive and drains to leave.
 *
 * The wave IS the boundary, not a decoration on one. The first version revealed
 * the widget with a CSS mask — a straight cut — and painted a wave over the top
 * of it, so the content actually appeared and disappeared along a flat line
 * while a crest undulated somewhere near it. The two never agreed, and that
 * disagreement is exactly what makes a thing look painted on.
 *
 * So the element is clipped to the wave itself. clip-path takes a polygon, a
 * polygon is just a list of points, and points can be recomputed every frame
 * for nothing — no mask image to re-parse, no gradient that refuses to
 * interpolate. The canvas then draws the water's body, its crest and its
 * bubbles from the SAME wave function, so the surface it draws is the surface
 * the widget is cut to.
 */
const WAVE_BAND = 26;      // px of drawn surface either side of the level
const BUBBLES = 14;
const POINTS = 48;         // polygon resolution along the crest

interface Bubble { x: number; y: number; r: number; v: number; seed: number }

/**
 * The body gradient, cached. It only depends on where the surface is, so it is
 * rebuilt when the level moves by more than a few pixels rather than 60 times a
 * second.
 */
let cachedFill: CanvasGradient | null = null;
let cachedKey = -1;
function bodyFill(ctx: CanvasRenderingContext2D, level: number, height: number): CanvasGradient {
  const key = Math.round(level / 8) * 1000 + Math.round(height);
  if (cachedFill && cachedKey === key) return cachedFill;
  const g = ctx.createLinearGradient(0, level, 0, height);
  g.addColorStop(0, 'rgba(125,180,225,0.20)');
  g.addColorStop(1, 'rgba(60,110,170,0.06)');
  cachedFill = g;
  cachedKey = key;
  return g;
}

/** Two components at different wavelengths, so the crest never repeats in a way
 *  the eye can catch. Shared by the clip and the drawing — that is the point. */
function waveAt(x: number, level: number, now: number): number {
  return level
    + Math.sin(x / 48 + now / 900) * 5
    + Math.sin(x / 19 - now / 1400) * 2;
}

/**
 * How full, 0 to 1.
 *
 * One easing curve, used forwards to fill and backwards to drain, so the two
 * are exact mirrors: at any instant the water that has left one widget is the
 * water that has arrived in the other. Rotation swaps one out for one in, so a
 * drain always has a fill to pour into — but only if they move as one, and
 * separate curves (easeOut arriving, easeIn leaving) meant they did not. One
 * would still be half full while the other had finished.
 *
 * Smoothstep rather than an expo: eased at both ends, and symmetric, which is
 * what mirroring requires.
 */
const smoothstep = (t: number) => t * t * (3 - 2 * t);

function fillOf(f: { progress: number; phase: string }): number {
  const e = smoothstep(Math.min(1, Math.max(0, f.progress)));
  return f.phase === 'in' ? e : 1 - e;
}

/** Water level in px from the top: 0 is full, height is empty. */
function levelOf(f: { progress: number; phase: string; height: number }): number {
  return f.height * (1 - fillOf(f));
}

export const liquid: ScreensaverEffect = {
  id: 'liquid',
  label: 'Fill and drain',
  spread: 40,
  durationMs: { in: 3600, out: 3600 },

  // A full glass is still carbonated. Without this the surface froze the
  // instant the level arrived, which made the whole thing read as an animation
  // that had finished rather than as water sitting there.
  ambient: true,

  // At rest: whole when shown, gone when not. The transition does the rest.
  css: (shown) => (shown ? { opacity: 1 } : { opacity: 0 }),

  elementStyle: (f: EffectFrame) => {
    const level = levelOf(f);
    const pts: string[] = [];
    for (let i = 0; i <= POINTS; i++) {
      const x = (f.width * i) / POINTS;
      const y = waveAt(x, level, f.now);
      pts.push(`${((x / f.width) * 100).toFixed(2)}% ${((y / f.height) * 100).toFixed(2)}%`);
    }
    pts.push('100% 100%', '0% 100%');
    return { opacity: '1', clipPath: `polygon(${pts.join(',')})` };
  },

  init: (): Bubble[] =>
    Array.from({ length: BUBBLES }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 1.5 + Math.random() * 3.5,
      v: 18 + Math.random() * 46,
      seed: Math.random() * 7,
    })),

  frame: (ctx, f: EffectFrame) => {
    const bubbles = f.state as Bubble[];
    const level = levelOf(f);
    const fill = fillOf(f);
    const waveY = (x: number) => waveAt(x, level, f.now);

    ctx.save();

    // The body of the water, tinted and translucent so the widget reads through
    // it. Same wave as the clip, so it sits exactly on the cut.
    //
    // Both the gradient and the path are deliberately cheap. Building two
    // gradients and two ~150-segment paths per widget per frame — for every
    // widget at rest, because the surface never stops moving — cost more than
    // the fireworks burst did: measured 16.8fps against a 54.4 baseline.
    // Only while the level is actually moving. A full glass needs no wash over
    // it: the widget is simply there, and tinting the whole of it — every
    // frame, for every settled widget — was both wrong to look at and the
    // single most expensive thing on the canvas. Four widgets each compositing
    // a translucent fill across their whole area is 1.2 million pixels a frame
    // of pure fill rate, and it held the screensaver at 17fps.
    if (fill < 0.995) {
      ctx.beginPath();
      ctx.moveTo(0, f.height);
      for (let x = 0; x <= f.width; x += 16) ctx.lineTo(x, waveY(x));
      ctx.lineTo(f.width, waveY(f.width));
      ctx.lineTo(f.width, f.height);
      ctx.closePath();
      ctx.fillStyle = bodyFill(ctx, level, f.height);
      ctx.fill();
    }

    for (const bub of bubbles) {
      bub.y -= (bub.v * f.dt) / 1000 / f.height;
      if (bub.y < 0) { bub.y = 1; bub.x = Math.random(); }
      const by = level + (f.height - level) * bub.y;
      if (by <= level + 2 || by >= f.height) continue;
      const bx = f.width * bub.x + Math.sin(f.now / 700 + bub.seed) * 3;
      ctx.beginPath();
      ctx.arc(bx, by, bub.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fill();
    }

    // The crest. This is the line the widget is actually cut along, which is
    // why it can be drawn hard: there is nothing behind it to give it away.
    // Drawn whenever there is any water at all, full included — the surface of
    // a full glass is at its top edge, and it still moves.
    if (fill > 0.002) {
      ctx.beginPath();
      for (let x = 0; x <= f.width; x += 12) {
        const y = waveY(x);
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(226,242,255,0.62)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    ctx.restore();
  },
};
