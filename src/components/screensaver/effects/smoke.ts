import type { EffectFrame, ScreensaverEffect } from './types';
import { easeInExpo, easeOutExpo } from './types';

/**
 * The widget thins out and gathers, behind a translucent front of smoke.
 *
 * Same shape as fill and drain, deliberately: something is on its way out while
 * something else is on its way in, and the boundary between "here" and "gone"
 * is a real edge you can point at. The difference is only that smoke has no
 * level, so the edge is a wide soft band rather than a line, and it takes the
 * widget with it as it passes.
 *
 * The mask is rebuilt every frame rather than transitioned. Chromium does not
 * interpolate between two gradients, so a CSS transition on mask-image snapped
 * from one to the other in a single frame — which is why this was
 * indistinguishable from a plain fade. Writing the gradient per frame needs no
 * interpolation at all, and puts the mask in lockstep with the puffs drawn over
 * it, which is what makes them look like the same event.
 */
const PUFFS = 22;

/**
 * The mask is three widget-heights tall and is SLID rather than redrawn: at 0%
 * the widget sits under the clear top third and is wholly gone, at 100% under
 * the opaque bottom third and wholly there, and in between a soft front crosses
 * it. A gradient rebuilt per frame could never reach "wholly gone" without
 * special-casing its stops, and a CSS transition on it snaps rather than
 * interpolates. A position is a length, and lengths are honest.
 *
 * The ramp is narrow on purpose, and getting that wrong is what made this look
 * like a fade with smoke drawn over it rather than like a mask. The mask image
 * is three widget-heights tall, so a ramp spanning 40% of it is 1.2 widget
 * heights — taller than the widget, which means every part of the widget is
 * part-masked at the same time and the whole thing simply dims. At 10% the band
 * is about a quarter of the widget, so there is an edge with somewhere to be.
 */
const MASK =
  'linear-gradient(to top, #000 0%, #000 34%, rgba(0,0,0,0.55) 39%, transparent 44%, transparent 100%)';

interface Puff { x: number; y: number; r: number; vy: number; phase: number }

/**
 * One puff, drawn once. Building a radial gradient per puff per frame — 26 of
 * them, 60 times a second — cost more than everything else in the screensaver
 * put together. The shape never changes here, only size and opacity.
 */
let sprite: HTMLCanvasElement | null = null;
function puffSprite(): HTMLCanvasElement {
  if (sprite) return sprite;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.35, 'rgba(219,229,241,0.26)');
  grad.addColorStop(0.7, 'rgba(190,205,225,0.08)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  sprite = c;
  return c;
}

/** How much of the widget is present, 0 gone to 1 whole. */
function presence(f: { progress: number; phase: string }): number {
  return f.phase === 'in' ? easeOutExpo(f.progress) : 1 - easeInExpo(f.progress);
}

export const smoke: ScreensaverEffect = {
  id: 'smoke',
  label: 'Smoke',
  spread: 260,
  durationMs: { in: 5600, out: 7000 },

  css: (shown) => (shown ? { opacity: 1 } : { opacity: 0 }),

  elementStyle: (f: EffectFrame) => {
    const v = presence(f);
    const pos = `0% ${(v * 100).toFixed(2)}%`;
    // Opacity is deliberately NOT touched. Fading the widget at the same time
    // as masking it is two departures at once, and the fade is the one you
    // notice — which is why this mode read as a plain fade with some haze over
    // it. The mask is the whole effect.
    return {
      opacity: '1',
      maskImage: MASK,
      webkitMaskImage: MASK,
      maskSize: '100% 300%',
      webkitMaskSize: '100% 300%',
      maskRepeat: 'no-repeat',
      webkitMaskRepeat: 'no-repeat',
      maskPosition: pos,
      webkitMaskPosition: pos,
    } as unknown as Partial<CSSStyleDeclaration>;
  },

  init: () =>
    Array.from({ length: PUFFS }, (): Puff => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.10 + Math.random() * 0.16,
      vy: 0.026 + Math.random() * 0.05,
      phase: Math.random() * 7,
    })),

  frame: (ctx, f: EffectFrame) => {
    const puffs = f.state as Puff[];
    if (!puffs) return;
    // Thickest where the widget is half gone, and absent at either end — smoke
    // should not appear from nothing or outlive the thing it came off.
    const strength = Math.sin(Math.PI * Math.min(1, Math.max(0, f.progress)));
    if (strength <= 0.01) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const q of puffs) {
      q.y -= (q.vy * f.dt) / 1000;
      if (q.y < -0.12) { q.y = 1.05; q.x = Math.random(); }
      // Kept over the widget it belongs to. The canvas is the whole screen, so
      // nothing stops a puff wandering across the board — and when it did, the
      // smoke read as weather over the entire screensaver rather than as one
      // widget going. A little drift and a little rise above the top edge is
      // all it takes to look like volume.
      const px = f.width * (0.08 + q.x * 0.84)
        + Math.sin(f.now / 5200 + q.phase) * f.width * 0.05;
      const py = f.height * (q.y * 1.1 - 0.08);
      const rr = Math.min(f.width, f.height) * q.r;
      if (rr <= 0) continue;
      ctx.globalAlpha = 0.30 * strength;
      ctx.drawImage(puffSprite(), px - rr, py - rr, rr * 2, rr * 2);
    }
    ctx.restore();
  },
};
