/**
 * @jest-environment jsdom
 */
/**
 * The four screensaver transitions are not variants of one technique, and the
 * registry is what keeps that honest: each effect declares which of the stage's
 * facilities it wants, and the stage provides exactly those. An effect that
 * asks for pixels without a frame loop, or takes over without asking for
 * pixels, would be silently broken at runtime — nothing would draw.
 */
import { EFFECTS, EFFECT_ORDER, getEffect } from '../index';
import { fireworks, __test as fw } from '../fireworks';

describe('effect registry', () => {
  it('offers exactly the four transitions', () => {
    expect([...EFFECT_ORDER]).toEqual(['fade', 'smoke', 'liquid', 'fireworks']);
    expect(Object.keys(EFFECTS).sort()).toEqual([...EFFECT_ORDER].sort());
  });

  it('gives every effect something the stage will actually drive', () => {
    // The stage only opens a transition for an effect that drives one of these.
    // Smoke once had only `frame`, lost it, and quietly became the plain fade —
    // no error, no missing style, just the wrong effect on screen.
    for (const id of EFFECT_ORDER) {
      const e = getEffect(id)!;
      if (e.css && !e.frame && !e.elementStyle && !e.startStyle) {
        // css-only effects are legitimate, but they must not also declare
        // per-frame behaviour that will never run
        expect(e.needsPixels).toBeFalsy();
        expect(e.takesOverAt).toBeUndefined();
      }
    }
  });

  it('gives every effect a way to actually show something', () => {
    for (const id of EFFECT_ORDER) {
      const e = getEffect(id)!;
      expect(e.css || e.frame).toBeTruthy();
    }
  });

  it('only asks for pixels where there is a frame loop to use them', () => {
    for (const id of EFFECT_ORDER) {
      const e = getEffect(id)!;
      if (e.needsPixels) expect(typeof e.frame).toBe('function');
    }
  });

  it('never hands over to a canvas that is not being drawn', () => {
    for (const id of EFFECT_ORDER) {
      const e = getEffect(id)!;
      if (e.takesOverAt !== undefined) {
        expect(typeof e.frame).toBe('function');
        expect(e.takesOverAt).toBeGreaterThanOrEqual(0);
        expect(e.takesOverAt).toBeLessThan(1);
      }
    }
  });

  it('keeps fireworks the only effect that costs a rasterisation', () => {
    const hungry = EFFECT_ORDER.filter((id) => getEffect(id)!.needsPixels);
    expect(hungry).toEqual(['fireworks']);
  });

  it('returns null for an unknown id rather than throwing', () => {
    expect(getEffect('nope')).toBeNull();
  });
});

/** A solid red block with a transparent margin, as ImageData. */
function block(w: number, h: number, alpha = 255): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const inside = x > 4 && x < w - 4 && y > 4 && y < h - 4;
      data[i] = 200; data[i + 1] = 30; data[i + 2] = 40;
      data[i + 3] = inside ? alpha : 0;
    }
  }
  return { data, width: w, height: h, colorSpace: 'srgb' } as ImageData;
}

describe('fireworks sampling', () => {
  it('is a stipple rather than a tiling', () => {
    // 1px grains sampled at 2px or wider: even keeping every sample, a quarter
    // of the area is covered at most. The keep share thins it further.
    expect(fw.GRAIN_PX).toBe(1);
    expect(fw.KEEP_CENTRE).toBeLessThan(0.9);
    expect(fw.keepAt(0.7)).toBeLessThan(fw.KEEP_CENTRE * 0.6);
  });

  it('thins toward the edges, so the source has no rectangle to it', () => {
    // a rectangle coming apart has a hard edge and four corners; nothing
    // explodes into those
    expect(fw.keepAt(0)).toBeGreaterThan(fw.keepAt(0.5));
    expect(fw.keepAt(0.5)).toBeGreaterThan(fw.keepAt(0.9));
    expect(fw.keepAt(1)).toBe(0);
  });

  it('leaves the corners of the widget empty', () => {
    const W = 400, H = 400;
    const sparks = fw.build(block(W, H), W, H);
    const half = Math.hypot(W, H) / 2;
    const corners = sparks.filter((s) => {
      const d = Math.hypot(s.x - W / 2, s.y - H / 2);
      return d > half * 0.88;
    });
    expect(corners.length).toBe(0);
  });

  it('does not hollow into a ring as it expands', () => {
    // Every fragment travels outward, so a field where they all move at a
    // similar rate empties its own middle: a donut with nothing in the hole.
    // Most of the mass has to stay near where it started.
    const W = 400, H = 400;
    const sparks = fw.build(block(W, H), W, H);
    const cx = W / 2, cy = H / 2;
    const half = Math.hypot(W, H) / 2;

    // step the same integration the effect runs, for two seconds
    const advance = (s: { x: number; y: number; dx: number; dy: number; v: number; acc: number }, secs: number) => {
      let { x, y, v } = s;
      const dt = 1 / 30;
      for (let t = 0; t < secs; t += dt) {
        v += s.acc * (0.35 + 1.9 * (t / secs)) * dt;
        x += s.dx * v * dt;
        y += s.dy * v * dt;
      }
      return { x, y };
    };

    const moved = sparks.map((s) => advance(s, 2));
    const inCore = moved.filter((m) => Math.hypot(m.x - cx, m.y - cy) < half * 0.35).length;
    const coreShare = inCore / moved.length;
    // The core is 19% of the widget's area, so an even spread would land 19%
    // of the fragments there. More than that means the middle is the densest
    // part of the field rather than a hole in it. A hollow shell scores near
    // zero — this was 0.00005 before the speed distribution was skewed.
    const areaShare = Math.PI * Math.pow(half * 0.35, 2) / (W * H);
    expect(coreShare).toBeGreaterThan(areaShare);
  });

  it('is densest in the middle', () => {
    const W = 400, H = 400;
    const sparks = fw.build(block(W, H), W, H);
    const half = Math.hypot(W, H) / 2;
    const near = sparks.filter((s) => Math.hypot(s.x - W / 2, s.y - H / 2) < half * 0.3).length;
    const far = sparks.filter((s) => {
      const d = Math.hypot(s.x - W / 2, s.y - H / 2);
      return d > half * 0.6 && d < half * 0.9;
    }).length;
    // per unit area, the middle wins comfortably
    const nearArea = Math.PI * Math.pow(half * 0.3, 2);
    const farArea = Math.PI * (Math.pow(half * 0.9, 2) - Math.pow(half * 0.6, 2));
    expect(near / nearArea).toBeGreaterThan((far / farArea) * 1.5);
  });

  it('ends up somewhere warmer than it started', () => {
    expect(fw.EMBER[0]).toBeGreaterThan(fw.EMBER[2]);
  });

  it('carries each pixel its own colour', () => {
    const sparks = fw.build(block(120, 120), 120, 120);
    expect(sparks.length).toBeGreaterThan(0);
    for (const s of sparks.slice(0, 20)) {
      expect([s.r, s.g, s.bl]).toEqual([200, 30, 40]);
    }
  });

  it('throws nothing where the widget is transparent', () => {
    const empty = block(120, 120, 0);
    expect(fw.build(empty, 120, 120)).toHaveLength(0);
  });

  it('caps the particle count so a full-width widget cannot melt the frame', () => {
    const sparks = fw.build(block(1900, 900), 1900, 900);
    expect(sparks.length).toBeLessThanOrEqual(fw.MAX_PARTICLES);
  });

  it('sends every fragment outward from the centre', () => {
    const sparks = fw.build(block(200, 200), 200, 200);
    for (const s of sparks.slice(0, 50)) {
      expect(Math.hypot(s.dx, s.dy)).toBeCloseTo(1, 3);
    }
  });

  it('announces the burst before it happens, at length', () => {
    // In seconds, not as a share of the transition. The share fell when the
    // burst was lengthened to let fragments drift further, while the wind-up
    // itself got longer in wall-clock — the fraction said it had shrunk. What
    // matters is that the card has time to shed its background and the widget
    // time to swell and draw back in, none of it quick enough to catch, and
    // that the burst still gets the greater part of the transition.
    const windUp = fireworks.durationMs.out * fw.SWELL_FRACTION;
    expect(windUp).toBeGreaterThan(4000);
    expect(fw.SWELL_FRACTION).toBeLessThan(0.5);
  });
});
