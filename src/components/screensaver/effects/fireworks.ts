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
const SAMPLE_PX = 2;
const MAX_PARTICLES = 42000;

/**
 * What the fragments cool into as they scatter.
 *
 * They leave carrying the widget's own colour, which is mostly frosted white,
 * and drift towards ember over their life. Keeping them white the whole way
 * reads as snow; going straight to orange loses the moment where the field is
 * still recognisably the widget. The shift is what makes it burn rather than
 * disperse.
 */
const EMBER = [255, 176, 74] as const;
/**
 * How much of the transition is spent winding up before the burst.
 *
 * The whole thing is deliberately long. This is slow motion: the field should
 * barely creep at the instant it comes apart and be moving fast by the time it
 * leaves the screen, which only reads if there is time to see it happen. A
 * short burst with the same acceleration curve just looks quick.
 */
const SWELL_FRACTION = 0.42;

interface Spark {
  x: number; y: number;
  dx: number; dy: number;
  v: number; acc: number;
  size: number;
  r: number; g: number; bl: number; a: number;
  life: number; age: number;
  /** Colour string, rebuilt only when the ember blend moves a whole step. */
  cache: string; bucket: number;
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
        // px/second, and deliberately almost nothing to begin with: at the
        // instant of the burst the field IS the widget, and it should look like
        // it for a moment. Nearly all the travel comes from acceleration, which
        // is what makes it read as slow motion rather than as a fast explosion
        // played back slowly. Outer pixels start marginally faster so the field
        // opens outward instead of smearing.
        v: 6 + (d / reach) * 16,
        acc: 90 + Math.random() * 130,
        size: step,
        r: data[i]!, g: data[i + 1]!, bl: data[i + 2]!, a: a / 255,
        cache: '', bucket: -1,
        life: 3.4 + Math.random() * 1.8,
        age: 0,
      });
    }
  }
  return sparks;
}

export const fireworks: ScreensaverEffect = {
  id: 'fireworks',
  label: 'Fireworks',
  spread: 2200,
  durationMs: { in: 3600, out: 9000 },
  needsPixels: true,
  takesOverAt: SWELL_FRACTION,

  /**
   * The announcement: one breath, handed to the compositor.
   *
   * Out first, slowly and quite still — the widget settles very slightly, which
   * is the only warning you get. Then in, swelling back past where it started,
   * trembling harder as it fills. It bursts at the top of the inhale.
   *
   * This used to be computed here and written to the element every frame, which
   * made it exactly as smooth as the effect stage's frame loop — and that loop
   * runs at whatever the machine can manage, measured as low as 18fps. A motion
   * this slow and this small (about one percent) has nowhere to hide a dropped
   * frame: it reads as stepping rather than as breathing. The curve now lives in
   * keyframes and the compositor runs it, so the main thread's frame rate stops
   * mattering.
   */
  startStyle: (phase, durationMs) =>
    phase === 'out'
      ? { animationDuration: `${Math.round(durationMs * SWELL_FRACTION)}ms`, opacity: '1' }
      : null,

  css: (shown) =>
    // Arriving is a plain fade. Two competing effects at once reads as a
    // glitch, not as a transition.
    //
    // Leaving is NOT a fade: the widget is at full strength right up to the
    // burst, and after it there is nothing left to see. Giving both states
    // opacity 1 — as this did — meant a departing widget never actually went
    // anywhere, and one that had gone sat there fully visible.
    shown
      ? { opacity: 1, transition: 'opacity 3.6s cubic-bezier(.33,0,.25,1)' }
      : { opacity: 0, transition: 'none' },

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
    ctx.globalAlpha = 1;
    for (let i = burst.sparks.length - 1; i >= 0; i--) {
      const k = burst.sparks[i]!;
      k.age += dt / 1000;
      const t = k.age / k.life;
      if (t >= 1) continue;
      // Everything in px/second, and the acceleration itself grows with age:
      // the field creeps at the instant it comes apart and is still gathering
      // pace as it goes, rather than settling into a constant drift. Constant
      // acceleration looked like a thing being pushed; this looks like one
      // coming apart.
      const secs = dt / 1000;
      k.v += k.acc * (0.35 + 1.9 * t) * secs;
      k.x += k.dx * k.v * secs;
      k.y += k.dy * k.v * secs;
      const alpha = k.a * Math.pow(1 - t, 1.4);
      if (alpha <= 0.012) continue;

      // Cool towards ember on the way out. Quantised into eight steps and
      // cached: building an rgba() string per fragment per frame means tens of
      // thousands of string builds and colour parses every 16ms, and that alone
      // took this from 54fps to 20. Fading is done with globalAlpha, which is a
      // number rather than a new colour.
      const bucket = (t * 8) | 0;
      if (bucket !== k.bucket) {
        const heat = Math.min(1, (bucket / 8) * 1.4);
        k.cache = `rgb(${Math.round(k.r + (EMBER[0] - k.r) * heat)},`
          + `${Math.round(k.g + (EMBER[1] - k.g) * heat)},`
          + `${Math.round(k.bl + (EMBER[2] - k.bl) * heat)})`;
        k.bucket = bucket;
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = k.cache;
      ctx.fillRect(k.x, k.y, k.size, k.size);
    }
    ctx.restore();
  },
};

/** Exported for tests: the sampling is the whole effect, so it is worth pinning. */
export const __test = { build, SAMPLE_PX, MAX_PARTICLES, SWELL_FRACTION, EMBER, easeOutExpo };
