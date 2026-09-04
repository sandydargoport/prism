import type { EffectFrame, ScreensaverEffect } from './types';

/**
 * A waterline crossing the widget: it fills to arrive and drains to leave.
 *
 * The level is moved with mask-POSITION, not by re-declaring the gradient.
 * Chromium does not interpolate between two different linear-gradient() values,
 * so animating mask-image snaps from one to the other in a single frame — with
 * an opacity transition alongside, that looked exactly like a plain crossfade,
 * which is what this mode did for its first outing. mask-position is a length,
 * and animates properly: measured 100 distinct waterline positions per
 * transition where the old version had one.
 *
 * The gradient is drawn at twice the widget's height so that sliding it from
 * one end to the other carries the waterline across the whole widget: its lower
 * half is opaque, its upper half is clear.
 */
const MASK = 'linear-gradient(to top, #000 0%, #000 46%, transparent 56%, transparent 100%)';

/**
 * The surface, drawn rather than masked.
 *
 * A CSS mask can move a waterline but it cannot make one behave like water: the
 * edge is whatever shape the gradient is, and it stays that shape. So the mask
 * still does the revealing — that is the part it is good at — and the canvas
 * draws the actual surface over the top: two sine components at different
 * wavelengths so the crest never repeats convincingly, a bright meniscus along
 * it, and bubbles that rise and pop. The straight cut the mask leaves sits
 * underneath the drawn band, which is what hides it.
 */
const WAVE_BAND = 26;      // px of drawn surface either side of the level
const BUBBLES = 14;

interface Bubble { x: number; y: number; r: number; v: number; seed: number }

/** Matches the mask's cubic-bezier(.45,.05,.55,.95) closely enough that the
 *  drawn surface sits over the cut rather than beside it. */
const easeInOut = (t: number) => t * t * (3 - 2 * t);

export const liquid: ScreensaverEffect = {
  id: 'liquid',
  label: 'Fill and drain',
  durationMs: { in: 3400, out: 3400 },

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
    const fill = f.phase === 'in' ? easeInOut(f.progress) : 1 - easeInOut(f.progress);
    const level = f.height * (1 - fill);
    const waveY = (x: number) =>
      level
      + Math.sin(x / 48 + f.now / 900) * 5
      + Math.sin(x / 19 - f.now / 1400) * 2;

    ctx.save();

    // The body of the water, tinted and translucent so the widget reads through it.
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

    // Bubbles, inside the water only.
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

    // The meniscus: a bright line right on the crest, which is what actually
    // reads as a surface rather than as a gradient.
    if (fill > 0.002 && fill < 0.998) {
      ctx.beginPath();
      for (let x = 0; x <= f.width; x += 4) {
        const y = waveY(x);
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(226,242,255,0.55)';
      ctx.lineWidth = 1.5;
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
  css: (shown) => ({
    WebkitMaskImage: MASK,
    maskImage: MASK,
    WebkitMaskSize: '100% 200%',
    maskSize: '100% 200%',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    // 0% shows the clear top half (empty); 100% the opaque bottom half (full).
    WebkitMaskPosition: shown ? '0% 100%' : '0% 0%',
    maskPosition: shown ? '0% 100%' : '0% 0%',
    transition:
      'mask-position 3.4s cubic-bezier(.45,.05,.55,.95), ' +
      '-webkit-mask-position 3.4s cubic-bezier(.45,.05,.55,.95)',
    // Opacity stays put: a fade running alongside the level hides the very
    // thing this mode exists to show.
    opacity: 1,
  }),
};
