import { focalPoint, focalOf, isFocalCoordinate, CENTRE } from '../focalPoint';

/** A w x h image of one colour, with an optional square of another. */
function image(w: number, h: number, ground: number[], square?: { x: number; y: number; size: number; rgb: number[] }) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inSq = square && x >= square.x && x < square.x + square.size && y >= square.y && y < square.y + square.size;
      const [r, g, b] = inSq ? square!.rgb : ground;
      const i = (y * w + x) * 4;
      px[i] = r!; px[i + 1] = g!; px[i + 2] = b!; px[i + 3] = 255;
    }
  }
  return px;
}

describe('focalPoint (#956)', () => {
  it('lands inside one bright square on a flat ground', () => {
    const sq = { x: 40, y: 8, size: 10, rgb: [250, 250, 250] };
    const p = focalPoint(image(64, 64, [30, 40, 50], sq), 64, 64);
    expect(p.x * 64).toBeGreaterThanOrEqual(sq.x);
    expect(p.x * 64).toBeLessThanOrEqual(sq.x + sq.size);
    expect(p.y * 64).toBeGreaterThanOrEqual(sq.y);
    expect(p.y * 64).toBeLessThanOrEqual(sq.y + sq.size);
  });

  it('finds a skin-toned patch on a busier ground', () => {
    const sq = { x: 6, y: 40, size: 12, rgb: [224, 172, 140] };
    const p = focalPoint(image(64, 64, [90, 120, 90], sq), 64, 64);
    expect(p.x * 64).toBeLessThanOrEqual(sq.x + sq.size);
    expect(p.y * 64).toBeGreaterThanOrEqual(sq.y);
  });

  it('is the centre for a flat image, or no image', () => {
    expect(focalPoint(image(32, 32, [120, 120, 120]), 32, 32)).toEqual(CENTRE);
    expect(focalPoint(new Uint8ClampedArray(0), 0, 0)).toEqual(CENTRE);
  });

  it('reads a missing focal point as the centre', () => {
    expect(focalOf({ focalX: null, focalY: null })).toEqual(CENTRE);
    expect(focalOf({})).toEqual(CENTRE);
    expect(focalOf({ focalX: 0.2, focalY: 0.7 })).toEqual({ x: 0.2, y: 0.7 });
  });

  it('accepts only numbers from 0 to 1', () => {
    expect([0, 0.5, 1].every(isFocalCoordinate)).toBe(true);
    expect([-0.1, 1.1, NaN, '0.5', null].some(isFocalCoordinate)).toBe(false);
  });
});
