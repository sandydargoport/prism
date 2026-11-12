/**
 * "Water": the material for text and cards over a photo (#799).
 *
 * One ink on a photo, light by day (warm white after dark). Cards over the
 * photo are a thin dark tint with a little blur, only as strong as the photo
 * under them needs; the clock and weather sit straight on the photo with a
 * soft shade under them, again only as strong as that corner needs.
 *
 * Everything here is pure: a photo's tone goes in, alphas come out, and a test
 * checks the contrast they buy. usePhotoTone does the sampling in the browser.
 */

/** The ink on a photo: warm near-white. */
export const WATER_INK = { r: 247, g: 242, b: 234 } as const;
/** The tint under a water card: warm near-black. */
export const WATER_TINT = { r: 24, g: 21, b: 17 } as const;

export const WATER = {
  /** The thinnest and thickest a water card gets. */
  alphaMin: 0.18,
  alphaMax: 0.6,
  /** Before a photo is measured, and for a photo that cannot be read. */
  alphaUnknown: 0.6,
  blurPx: 10,
  /** Text in a card: 4.5:1 plus a margin for the saturate filter. */
  contrastCard: 4.8,
  /** Corner text straight on the photo: the date and weather lines. */
  contrastCorner: 4.5,
  /** A shade darker than this reads as fog; past it the text shadow helps. */
  shadeMax: 0.45,
  shadeUnknown: 0.35,
  /** Performance Reduced: no blur, so a little more tint. */
  reducedExtra: 0.1,
  reducedMax: 0.7,
} as const;

type Rgb = { r: number; g: number; b: number };

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance of an sRGB colour, 0 to 1. */
export function luminance({ r, g, b }: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** The sRGB grey whose luminance is `l`, so a tone can be composited. */
export function greyFor(l: number): number {
  const lin = Math.min(1, Math.max(0, l));
  const s = lin <= 0.0031308 ? lin * 12.92 : 1.055 * lin ** (1 / 2.4) - 0.055;
  return s * 255;
}

/** `top` laid over `under` at `alpha`, as the browser blends sRGB. */
function over(top: Rgb, under: Rgb, alpha: number): Rgb {
  return {
    r: top.r * alpha + under.r * (1 - alpha),
    g: top.g * alpha + under.g * (1 - alpha),
    b: top.b * alpha + under.b * (1 - alpha),
  };
}

const BLACK = { r: 0, g: 0, b: 0 };

/** The photo's brightest tone after the page's black dim layer. */
function dimmed(lMax: number, dim: number): Rgb {
  const g = greyFor(lMax);
  return over(BLACK, { r: g, g, b: g }, dim);
}

/** Contrast of the ink over a photo tone under a dim and a tint. */
export function inkContrast(lMax: number, dim: number, tint: Rgb, alpha: number): number {
  return contrast(luminance(WATER_INK), luminance(over(tint, dimmed(lMax, dim), alpha)));
}

/** Smallest alpha in [lo, hi] for which the ink reaches `target`; hi if none does. */
function solve(lMax: number, dim: number, tint: Rgb, target: number, lo: number, hi: number): number {
  if (inkContrast(lMax, dim, tint, lo) >= target) return lo;
  for (let a = lo; a <= hi + 1e-9; a += 0.01) {
    if (inkContrast(lMax, dim, tint, a) >= target) return Math.round(a * 100) / 100;
  }
  return hi;
}

/**
 * How thick the water cards on a screen are: just enough for the ink over the
 * brightest part of the photo, between WATER.alphaMin and WATER.alphaMax.
 */
export function waterAlpha(lMax: number, dim: number): number {
  return solve(lMax, dim, WATER_TINT, WATER.contrastCard, WATER.alphaMin, WATER.alphaMax);
}

/** How dark the shade under a corner or the bottom text is. 0 when not needed. */
export function shadeAlpha(lMax: number, dim: number): number {
  return solve(lMax, dim, BLACK, WATER.contrastCorner, 0, WATER.shadeMax);
}

/** The same card under Performance Reduced, where there is no blur. */
export function reducedAlpha(alpha: number): number {
  return Math.min(WATER.reducedMax, Math.round((alpha + WATER.reducedExtra) * 100) / 100);
}

export interface PhotoTone {
  /** Brightest cell anywhere, and in the three places text sits. */
  all: number;
  topLeft: number;
  topRight: number;
  bottom: number;
}

/**
 * Tone of a photo from its pixels, drawn small (about 48 wide). Each cell is
 * the average of a few pixels, which is close to what a 10px blur sees, and
 * each region keeps its brightest cell, since the text has to read over that.
 */
export function photoTone(data: Uint8ClampedArray | number[], width: number, height: number): PhotoTone {
  let all = 0, topLeft = 0, topRight = 0, bottom = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const l = luminance({ r: data[i]!, g: data[i + 1]!, b: data[i + 2]! });
      if (l > all) all = l;
      const top = y < height * 0.25;
      if (top && x < width * 0.3 && l > topLeft) topLeft = l;
      if (top && x >= width * 0.7 && l > topRight) topRight = l;
      if (y >= height * 0.7 && l > bottom) bottom = l;
    }
  }
  return { all, topLeft, topRight, bottom };
}

/** The CSS values a photo's tone sets on the page. */
export function waterVars(tone: PhotoTone | null, dim: number): Record<string, string> {
  const alpha = tone ? waterAlpha(tone.all, dim) : WATER.alphaUnknown;
  const shade = (l: number | undefined) => String(tone && l !== undefined ? shadeAlpha(l, dim) : WATER.shadeUnknown);
  return {
    '--ds-water-alpha': String(alpha),
    '--ds-water-alpha-reduced': String(reducedAlpha(alpha)),
    '--ds-shade-tl': shade(tone?.topLeft),
    '--ds-shade-tr': shade(tone?.topRight),
    '--ds-shade-bottom': shade(tone?.bottom),
  };
}
