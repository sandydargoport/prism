import type { EffectFrame, ScreensaverEffect } from './types';
import { easeOutExpo } from './types';

/**
 * The widget comes apart into its own pixels.
 *
 * This is the one effect that cannot be a mask. A mask erodes a thing where it
 * already is; here every fragment has to travel on its own. So the widget is
 * sampled pixel by pixel and each sample becomes a particle carrying that
 * pixel's own colour. At the instant of the burst the particle field IS the
 * widget — you are looking at its own pixels — and it stops being the widget
 * only as they separate. That is why it has to be dense: sparse, it reads as
 * confetti thrown at a widget; dense, it reads as the widget coming apart.
 *
 * Two things that are easy to get wrong and were:
 *
 *  - The particles ACCELERATE. They barely creep at the moment of the burst and
 *    pick up speed as they spread, which is what makes it read as slow motion
 *    rather than as a firework played back slowly. Decelerating particles look
 *    like a thing being deflated.
 *
 *  - The widget holds and swells first. Announcing the burst — one or two slow
 *    bulges — is the difference between "it came apart" and "it vanished". The
 *    swell is deliberately small; at full size it read as cartoonish.
 */
/**
 * Density is the whole effect.
 *
 * The sample spacing — not the count — decides whether this reads as the widget
 * coming apart or as confetti thrown at it. At a 9px spacing you can see the
 * individual blocks and the clock's own digits survive as chunks; at 4px the
 * field is contiguous at the moment of the burst, which is the point. The count
 * follows from the spacing and the widget's area, so it is capped rather than
 * targeted: a full-width widget would otherwise ask for 90,000 particles.
 */
const SAMPLE_PX = 4;
const MAX_PARTICLES = 26000;
const SWELL_FRACTION = 0.28; // of the transition spent swelling before the burst

interface Spark {
  x: number; y: number;
  dx: number; dy: number;
  v: number; acc: number;
  size: number; colour: string;
  life: number; age: number;
}

interface Burst { sparks: Spark[]; built: boolean }

function build(pixels: ImageData, width: number, height: number): Spark[] {
  const { data, width: pw, height: ph } = pixels;
  const step = Math.max(SAMPLE_PX, Math.ceil(Math.sqrt((pw * ph) / MAX_PARTICLES)));
  const cx = pw / 2;
  const cy = ph / 2;
  const reach = Math.hypot(pw, ph) / 2;
  const sx = width / pw;
  const sy = height / ph;
  const sparks: Spark[] = [];

  for (let y = 0; y < ph; y += step) {
    for (let x = 0; x < pw; x += step) {
      const i = (y * pw + x) * 4;
      const a = data[i + 3]!;
      if (a < 24) continue; // nothing here to throw
      const ox = x - cx;
      const oy = y - cy;
      const d = Math.hypot(ox, oy) || 1;
      sparks.push({
        x: x * sx,
        y: y * sy,
        dx: ox / d,
        dy: oy / d,
        // Outer pixels start faster, so the field opens rather than smears.
        v: 0.02 + (d / reach) * 0.05,
        acc: 0.5 + Math.random() * 0.9,
        size: Math.max(1, step * 0.9),
        colour: `rgba(${data[i]},${data[i + 1]},${data[i + 2]},${(a / 255).toFixed(3)})`,
        life: 0.55 + Math.random() * 0.45,
        age: 0,
      });
    }
  }
  return sparks;
}

export const fireworks: ScreensaverEffect = {
  id: 'fireworks',
  label: 'Fireworks',
  durationMs: { in: 2200, out: 2600 },
  needsPixels: true,
  takesOverAt: SWELL_FRACTION,

  /**
   * The announcement, on the real widget: one and a half slow bulges with a
   * shake barely above the threshold of noticing. Deliberately small — at full
   * size it read as cartoonish.
   */
  elementStyle: (progress) => {
    if (progress >= SWELL_FRACTION) return null;
    const t = progress / SWELL_FRACTION;
    const swell = 1 + Math.sin(t * Math.PI * 1.5) * 0.012 * (1 - t * 0.3);
    const shake = Math.sin(t * Math.PI * 14) * 1.1 * t;
    return { transform: `translateX(${shake.toFixed(2)}px) scale(${swell.toFixed(4)})` };
  },

  css: (shown) =>
    // Arriving is a plain fade. Two competing effects at once reads as a
    // glitch, not as a transition.
    shown
      ? { opacity: 1, transition: 'opacity 2.2s cubic-bezier(.16,1,.3,1)' }
      : { opacity: 1 },

  init: (): Burst => ({ sparks: [], built: false }),

  frame: (ctx, f: EffectFrame) => {
    const burst = f.state as Burst;
    if (!burst || !f.pixels) return;

    // The hold-and-swell is done by the live element (see elementStyle), so
    // there is nothing to draw until it bursts.
    if (f.progress < SWELL_FRACTION) return;

    if (!burst.built) {
      burst.sparks = build(f.pixels, f.width, f.height);
      burst.built = true;
    }

    const dt = Math.min(f.dt, 48); // a dropped frame must not teleport the field
    ctx.save();
    for (let i = burst.sparks.length - 1; i >= 0; i--) {
      const k = burst.sparks[i]!;
      k.age += dt / 1000;
      const t = k.age / k.life;
      if (t >= 1) continue;
      k.v += k.acc * (dt / 1000);
      k.x += k.dx * k.v * dt * 0.06;
      k.y += k.dy * k.v * dt * 0.06;
      const alpha = Math.pow(1 - t, 1.5);
      if (alpha <= 0.015) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = k.colour;
      ctx.fillRect(k.x, k.y, k.size, k.size);
    }
    ctx.restore();
  },
};

/** Exported for tests: the sampling is the whole effect, so it is worth pinning. */
export const __test = { build, SAMPLE_PX, MAX_PARTICLES, SWELL_FRACTION, easeOutExpo };
