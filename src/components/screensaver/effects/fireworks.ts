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
 * Not every pixel gets to be a fragment, and the ones near the edges least of
 * all.
 *
 * Two separate problems, one mechanism.
 *
 * Drawing one square per sample, sized to the spacing, tiles the widget solidly
 * — so the field starts as an exact mosaic and only looks like anything once it
 * has spread far enough to break up. Which is backwards: the moment it comes
 * apart should be the best-looking one. So grains are drawn smaller than the
 * spacing they are sampled at, and most are dropped.
 *
 * And a widget is a rectangle, so keeping an even share everywhere made the
 * burst visibly a rectangle coming apart — a hard edge and four corners, which
 * nothing in the world explodes into. The share kept now falls off from the
 * middle outward, reaching nothing before the corners, so what leaves is a soft
 * mass with no edge to it. The widget is still legible in the first instant,
 * because that is where the density is.
 */
const GRAIN_PX = 1;

/**
 * How much of the transition is spent winding up before the burst.
 *
 * The whole thing is deliberately long. This is slow motion: the field should
 * barely creep at the instant it comes apart and be moving fast by the time it
 * leaves the screen, which only reads if there is time to see it happen.
 */
const SWELL_FRACTION = 0.3;

/** Kept at the centre of mass. */
const KEEP_CENTRE = 0.78;

/** How sharply that falls off toward the edges. Higher empties the rim sooner. */
const FALLOFF = 1.9;

/**
 * The fraction of the half-diagonal at which nothing is kept at all.
 *
 * Below 1, deliberately. Measuring the falloff against the corner itself leaves
 * a thin scatter all the way out to it, and four sparse corners still read as a
 * rectangle — the shape survives in the outline even when the fill has gone.
 *
 * Not too far below 1 either. This and the radial wash in the snapshot are both
 * pushing the mass round, and between them it is easy to end up with a clean
 * disc, which looks manufactured. The widget's own content should still be
 * showing through as irregularity.
 */
const EDGE = 0.98;

/**
 * What the fragments cool into as they scatter.
 *
 * They leave carrying the widget's own colour, which is mostly frosted white,
 * and drift towards ember over their life. Keeping them white the whole way
 * reads as snow; going straight to orange loses the moment where the field is
 * still recognisably the widget.
 */
const EMBER = [255, 176, 74] as const;

/** Ceiling on the number of grains, whatever size the widget is. */
const MAX_PARTICLES = 74000;

/**
 * The share of pixels kept at a given distance from the centre, where r is 0 in
 * the middle and 1 at the furthest corner.
 */
export function keepAt(r: number): number {
  const rr = Math.min(1, r / EDGE);
  return KEEP_CENTRE * Math.max(0, 1 - Math.pow(rr, FALLOFF));
}

/** Measured mean of keepAt across a rectangle — stable at 0.32 for every aspect
 *  ratio tried, which is what the spacing is chosen against. */
const MEAN_KEPT = 0.25;

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

interface Burst {
  sparks: Spark[];
  built: boolean;
  /** Reused pixel buffer; see the note in frame(). */
  buf: ImageData | null;
  bufW: number;
  bufH: number;
  /** The buffer is composited through this, not written straight to the stage. */
  off: HTMLCanvasElement | null;
}

function build(pixels: ImageData, width: number, height: number): Spark[] {
  const { data, width: pw, height: ph } = pixels;
  // Roughly a third of the samples survive the falloff, so the spacing is
  // chosen against the kept count rather than the raw one — otherwise thinning
  // the field also coarsens it, which is the opposite of the point.
  const step = Math.max(1, Math.ceil(Math.sqrt((pw * ph * MEAN_KEPT) / MAX_PARTICLES)));
  const cx = pw / 2;
  const cy = ph / 2;
  const reach = Math.hypot(pw, ph) / 2;
  // Shape is measured against the short side, not the diagonal. Measured
  // against the diagonal, a wide widget keeps everything out to its left and
  // right extremes and drops only the corners — which still reads as a
  // rectangle with the corners knocked off. Against the short side the kept
  // region is a circle inscribed in the widget, whatever its aspect ratio.
  const shapeReach = Math.min(pw, ph) / 2;
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
      if (Math.random() > keepAt(d / shapeReach)) continue;
      // Cubed, with no floor, because acceleration dominates: a fragment at
      // even a third of full speed still crosses 200px in two seconds. Only
      // below about 0.15 does one stay anywhere near where it started, so the
      // distribution has to put a real share of the field down there — roughly
      // half — or the middle empties and what is left is a ring.
      const speed = Math.pow(Math.random(), 4) * 1.6;
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
        // Both scaled by where the fragment started, not just its speed roll.
        //
        // With a radius-independent acceleration every fragment is flung as
        // hard as every other, so the middle empties at the same rate the rim
        // does and the field becomes a ring with nothing in the hole. Tying the
        // push to the starting radius makes the expansion self-similar: the
        // field grows without redistributing itself, so the middle stays the
        // densest part of it, which is where the widget was.
        v: (2 + (d / reach) * 22) * speed,
        acc: ((d / reach) * 250 + Math.random() * 26) * speed,
        size: GRAIN_PX,
        r: data[i]!, g: data[i + 1]!, bl: data[i + 2]!, a: a / 255,
        cache: '', bucket: -1,
        life: 8 + Math.random() * 4.5,
        age: 0,
      });
    }
  }
  // The spacing above is chosen from a measured average, and an average is not
  // a guarantee. Trim rather than trust it.
  if (sparks.length > MAX_PARTICLES) sparks.length = MAX_PARTICLES;
  return sparks;
}

export const fireworks: ScreensaverEffect = {
  id: 'fireworks',
  label: 'Fireworks',
  spread: 2200,
  durationMs: { in: 4200, out: 22000 },
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

  /** The card sheds its background before anything moves, and puts it back on
   *  arrival — see .prism-shed. */
  shedsCard: true,

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

  init: (): Burst => ({ sparks: [], built: false, buf: null, bufW: 0, bufH: 0, off: null }),

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

    // Fragments are written into a pixel buffer, not stroked onto the canvas.
    //
    // Tens of thousands of one-pixel fillRect calls a frame is tens of
    // thousands of canvas state changes a frame, and it does not matter that
    // each one is trivial — the per-call overhead is the whole cost, and it put
    // this well under a smooth frame rate on ordinary hardware. Writing four
    // bytes into a typed array has no such overhead.
    //
    // Only the region the field currently occupies is allocated, cleared and
    // uploaded. Early in the burst that is about the size of the widget; it
    // grows as the field spreads, which is exactly when fragments have thinned
    // out enough for the upload to still be cheap.
    const tf = ctx.getTransform();
    const originX = tf.e / (tf.a || 1);
    const originY = tf.f / (tf.d || 1);
    const canvasW = ctx.canvas.width;
    const canvasH = ctx.canvas.height;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < burst.sparks.length; i++) {
      const k = burst.sparks[i]!;
      k.age += dt / 1000;
      const t = k.age / k.life;
      if (t >= 1) continue;
      const secs = dt / 1000;
      k.v += k.acc * (0.35 + 1.9 * t) * secs;
      k.x += k.dx * k.v * secs;
      k.y += k.dy * k.v * secs;
      const sx = originX + k.x;
      const sy = originY + k.y;
      if (sx < minX) minX = sx;
      if (sx > maxX) maxX = sx;
      if (sy < minY) minY = sy;
      if (sy > maxY) maxY = sy;
    }
    if (minX > maxX) return;

    const x0 = Math.max(0, Math.floor(minX));
    const y0 = Math.max(0, Math.floor(minY));
    const x1 = Math.min(canvasW, Math.ceil(maxX) + 1);
    const y1 = Math.min(canvasH, Math.ceil(maxY) + 1);
    const w = x1 - x0;
    const h = y1 - y0;
    if (w <= 0 || h <= 0) return;

    if (!burst.buf || burst.bufW < w || burst.bufH < h) {
      const bw = Math.max(w, burst.bufW);
      const bh = Math.max(h, burst.bufH);
      burst.buf = ctx.createImageData(bw, bh);
      burst.bufW = bw;
      burst.bufH = bh;
      burst.off = document.createElement('canvas');
      burst.off.width = bw;
      burst.off.height = bh;
    }
    const buf = burst.buf;
    const data = buf.data;
    data.fill(0);
    const stride = buf.width;

    for (let i = 0; i < burst.sparks.length; i++) {
      const k = burst.sparks[i]!;
      const t = k.age / k.life;
      if (t >= 1) continue;
      // The pixel's own alpha, unmodified. Lifting it clipped the brighter
      // fragments toward white, and the field stopped looking like the widget
      // it came off — which is the one thing this effect has going for it.
      const alpha = k.a * (1 - t);
      if (alpha <= 0.012) continue;
      const px = (originX + k.x - x0) | 0;
      const py = (originY + k.y - y0) | 0;
      if (px < 0 || py < 0 || px >= stride || py >= buf.height) continue;

      // Cool towards ember on the way out.
      const heat = Math.min(1, t * 1.4);
      const o = (py * stride + px) * 4;
      data[o] = k.r + (EMBER[0] - k.r) * heat;
      data[o + 1] = k.g + (EMBER[1] - k.g) * heat;
      data[o + 2] = k.bl + (EMBER[2] - k.bl) * heat;
      data[o + 3] = alpha * 255;
    }

    // Composited through an offscreen canvas, NOT written to the stage
    // directly.
    //
    // putImageData replaces the destination rather than blending with it, so
    // every pixel in the rectangle is overwritten — transparent ones included.
    // With two widgets bursting at once, the second one's rectangle wiped the
    // first one's fragments wherever the two overlapped, and left a hard square
    // hole in the middle of the field. drawImage composites, which is what is
    // wanted; putImageData is only how the pixels get into a canvas to start
    // with.
    const off = burst.off;
    if (!off) return;
    const offCtx = off.getContext('2d');
    if (!offCtx) return;
    offCtx.putImageData(buf, 0, 0, 0, 0, w, h);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(off, 0, 0, w, h, x0, y0, w, h);
    ctx.restore();
  },
};

/** Exported for tests: the sampling is the whole effect, so it is worth pinning. */
export const __test = { build, keepAt, MAX_PARTICLES, GRAIN_PX, KEEP_CENTRE, SWELL_FRACTION, EMBER, easeOutExpo };
