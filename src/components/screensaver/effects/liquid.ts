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

/** Two components at different wavelengths, so the crest never repeats in a way
 *  the eye can catch. Shared by the clip and the drawing — that is the point. */
function waveAt(x: number, level: number, now: number): number {
  return level
    + Math.sin(x / 48 + now / 900) * 5
    + Math.sin(x / 19 - now / 1400) * 2;
}

const easeInOut = (t: number) => t * t * (3 - 2 * t);

/** Water level in px from the top: 0 is full, height is empty. */
function levelOf(f: { progress: number; phase: string; height: number }): number {
  const fill = f.phase === 'in' ? easeInOut(f.progress) : 1 - easeInOut(f.progress);
  return f.height * (1 - fill);
}

export const liquid: ScreensaverEffect = {
  id: 'liquid',
  label: 'Fill and drain',
  durationMs: { in: 3400, out: 3400 },

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
    const waveY = (x: number) => waveAt(x, level, f.now);

    ctx.save();

    // The body of the water, tinted and translucent so the widget reads through
    // it. Same polygon as the clip, so it sits exactly on the cut.
    ctx.beginPath();
    ctx.moveTo(0, f.height);
    for (let x = 0; x <= f.width; x += 6) ctx.lineTo(x, waveY(x));
    ctx.lineTo(f.width, f.height);
    ctx.closePath();
    const body = ctx.createLinearGradient(0, level, 0, f.height);
    body.addColorStop(0, 'rgba(125,180,225,0.20)');
    body.addColorStop(1, 'rgba(60,110,170,0.06)');
    ctx.fillStyle = body;
    ctx.fill();

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
    const fill = f.phase === 'in' ? easeInOut(f.progress) : 1 - easeInOut(f.progress);
    if (fill > 0.002 && fill < 0.998) {
      ctx.beginPath();
      for (let x = 0; x <= f.width; x += 4) {
        const y = waveY(x);
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(226,242,255,0.62)';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      const glow = ctx.createLinearGradient(0, level - WAVE_BAND, 0, level + WAVE_BAND);
      glow.addColorStop(0, 'rgba(255,255,255,0)');
      glow.addColorStop(0.5, 'rgba(214,236,255,0.16)');
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, level - WAVE_BAND, f.width, WAVE_BAND * 2);
    }

    ctx.restore();
  },
};
