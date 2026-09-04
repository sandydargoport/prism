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
import { __test as fw } from '../fireworks';

describe('effect registry', () => {
  it('offers exactly the four transitions', () => {
    expect([...EFFECT_ORDER]).toEqual(['fade', 'smoke', 'liquid', 'fireworks']);
    expect(Object.keys(EFFECTS).sort()).toEqual([...EFFECT_ORDER].sort());
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
  it('samples densely enough to read as the widget, not as confetti', () => {
    const sparks = fw.build(block(200, 160), 200, 160);
    // spacing, not count, is what makes the field contiguous at the burst
    expect(fw.SAMPLE_PX).toBeLessThanOrEqual(4);
    expect(sparks.length).toBeGreaterThan(1500);
  });

  it('carries each pixel its own colour', () => {
    const sparks = fw.build(block(120, 120), 120, 120);
    expect(sparks.length).toBeGreaterThan(0);
    for (const s of sparks.slice(0, 20)) expect(s.colour).toContain('200,30,40');
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

  it('announces the burst before it happens', () => {
    // the swell has to occupy real time, or the widget just vanishes
    expect(fw.SWELL_FRACTION).toBeGreaterThan(0.1);
    expect(fw.SWELL_FRACTION).toBeLessThan(0.5);
  });
});
