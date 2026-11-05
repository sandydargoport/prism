/**
 * Water (#799): the tint and shade a photo gets are only as strong as it
 * needs, and always strong enough for the ink to read.
 */
import {
  contrast, inkContrast, luminance, photoTone, reducedAlpha, shadeAlpha, WATER, WATER_INK,
  WATER_TINT, waterAlpha, waterVars,
} from '../water';
import { PHOTO_DIM } from '../tokens';

const DIMS = [PHOTO_DIM.scenery.light, PHOTO_DIM.scenery.dark, PHOTO_DIM.photos.light, PHOTO_DIM.photos.dark];

/** A width x height RGBA image of one grey, with optional bright cells. */
function image(width: number, height: number, grey: number, bright: Array<[number, number]> = []) {
  const data = new Array(width * height * 4).fill(0).map((_, i) => (i % 4 === 3 ? 255 : grey));
  for (const [x, y] of bright) for (let c = 0; c < 3; c++) data[(y * width + x) * 4 + c] = 255;
  return data;
}

describe('the tone sampler', () => {
  it('reads black as 0 and white as about 1', () => {
    expect(photoTone(image(48, 27, 0), 48, 27).all).toBe(0);
    expect(photoTone(image(48, 27, 255), 48, 27).all).toBeCloseTo(1, 5);
  });

  it('keeps the brightest cell of each region where text sits', () => {
    // Dark photo, one bright cell in the top-left corner and one at the bottom.
    const tone = photoTone(image(48, 27, 20, [[2, 2], [24, 25]]), 48, 27);
    expect(tone.topLeft).toBeCloseTo(1, 5);
    expect(tone.bottom).toBeCloseTo(1, 5);
    expect(tone.topRight).toBeLessThan(0.01);
  });
});

describe('water cards', () => {
  it('get thicker as the photo gets brighter, within the limits', () => {
    const alphas = [0, 0.1, 0.3, 0.6, 1].map((l) => waterAlpha(l, PHOTO_DIM.scenery.light));
    for (let i = 1; i < alphas.length; i++) expect(alphas[i]).toBeGreaterThanOrEqual(alphas[i - 1]!);
    expect(alphas[0]).toBe(WATER.alphaMin);
    expect(alphas[alphas.length - 1]).toBeLessThanOrEqual(WATER.alphaMax);
  });

  it.each(DIMS)('keep the ink at 4.5:1 or better over any photo under a %s dim', (dim) => {
    for (let l = 0; l <= 1.0001; l += 0.05) {
      const a = waterAlpha(l, dim);
      expect(inkContrast(l, dim, WATER_TINT, a)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('are clearer than the old glass over a mid-tone sky', () => {
    expect(waterAlpha(0.2, PHOTO_DIM.scenery.light)).toBeLessThan(0.4);
  });

  it('get a little more tint without blur, never past the cap', () => {
    expect(reducedAlpha(0.3)).toBeCloseTo(0.4, 5);
    expect(reducedAlpha(WATER.alphaMax)).toBe(WATER.reducedMax);
  });
});

describe('shades under text on the photo', () => {
  it('are not drawn over a dark corner', () => {
    expect(shadeAlpha(0.02, PHOTO_DIM.scenery.light)).toBe(0);
  });

  it('reach 4.5:1 for the corner text over a mid-tone corner', () => {
    const l = 0.25;
    const a = shadeAlpha(l, PHOTO_DIM.scenery.light);
    expect(a).toBeGreaterThan(0);
    expect(inkContrast(l, PHOTO_DIM.scenery.light, { r: 0, g: 0, b: 0 }, a)).toBeGreaterThanOrEqual(4.5);
  });

  it('never get darker than the fog limit', () => {
    expect(shadeAlpha(1, PHOTO_DIM.scenery.light)).toBe(WATER.shadeMax);
  });
});

describe('the page values', () => {
  it('fall back to safe values before a photo is measured', () => {
    expect(waterVars(null, 0.1)).toMatchObject({
      '--ds-water-alpha': String(WATER.alphaUnknown),
      '--ds-shade-tl': String(WATER.shadeUnknown),
    });
  });

  it('ink is near white, far from the tint', () => {
    expect(contrast(luminance(WATER_INK), luminance(WATER_TINT))).toBeGreaterThan(14);
  });
});
