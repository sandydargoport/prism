import type { EffectFrame, ScreensaverEffect } from './types';
import { easeInExpo, easeOutExpo } from './types';

/**
 * The widget itself dissolves, the way smoke does.
 *
 * Two earlier versions got this wrong in the same way, and it is worth naming
 * because it is a tempting mistake: they drew smoke. First a horizontal front
 * sliding up the widget — which is the waterline again, so it looked like a
 * second fill-and-drain — and then soft blobs opening at fixed points with
 * drifting puffs painted over the top. Both had a widget appearing or
 * disappearing on one schedule and a smoke effect running on another, and you
 * could see they were two things.
 *
 * There is no smoke here at all. There is a mask made of turbulence, and the
 * widget is eaten away through it. What thins out IS the image: its own pixels,
 * going in patches at the scale and irregularity of smoke, with soft edges
 * because the threshold is gentle. Nothing is drawn on top of anything.
 *
 * The mask is an SVG filter chain — fractal noise, moved into the alpha
 * channel, then put through a linear transfer whose intercept sweeps from
 * "nothing survives" to "everything does". Sweeping that is the dissolve.
 * Because a filter cannot be animated from CSS, the masks are pre-rendered at
 * a set of thresholds and swapped; they are cached by URL after the first use,
 * so the whole effect costs one string lookup a frame and no canvas at all.
 */
const STEPS = 26;

/** Gentle. A steep slope gives hard-edged fragments — that is the fireworks
 *  look, not this one. Smoke has no edges to speak of. */
const SLOPE = 2.4;

const cache = new Map<number, string>();

function maskAt(step: number): string {
  const hit = cache.get(step);
  if (hit) return hit;

  const t = step / (STEPS - 1);
  // At t=0 nothing survives the threshold; at t=1 everything does.
  const intercept = -SLOPE + t * (1 + SLOPE);
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">'
    + '<filter id="s" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">'
    + '<feTurbulence type="fractalNoise" baseFrequency="0.013" numOctaves="4" seed="9"/>'
    + '<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0"/>'
    + '<feComponentTransfer>'
    + `<feFuncA type="linear" slope="${SLOPE}" intercept="${intercept.toFixed(3)}"/>`
    + '</feComponentTransfer>'
    + '</filter>'
    + '<rect width="100%" height="100%" filter="url(#s)"/>'
    + '</svg>';

  const uri = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
  cache.set(step, uri);
  return uri;
}

/** How much of the widget is present, 0 gone to 1 whole. */
function presence(f: { progress: number; phase: string }): number {
  return f.phase === 'in' ? easeOutExpo(f.progress) : 1 - easeInExpo(f.progress);
}

export const smoke: ScreensaverEffect = {
  id: 'smoke',
  label: 'Smoke',
  spread: 0,
  durationMs: { in: 5600, out: 7000 },

  css: (shown) => (shown ? { opacity: 1 } : { opacity: 0 }),

  elementStyle: (f: EffectFrame) => {
    const v = presence(f);
    const mask = maskAt(Math.round(v * (STEPS - 1)));
    // Opacity is deliberately NOT touched. Fading the widget while also masking
    // it is two departures at once, and the fade is the one you notice.
    return {
      opacity: '1',
      maskImage: mask,
      webkitMaskImage: mask,
      maskSize: '100% 100%',
      webkitMaskSize: '100% 100%',
      maskRepeat: 'no-repeat',
      webkitMaskRepeat: 'no-repeat',
    } as unknown as Partial<CSSStyleDeclaration>;
  },
};
