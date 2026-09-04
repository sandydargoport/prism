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
const PUFFS = 26;
const FEATHER = 38;   // % of the widget the soft edge spans

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
  durationMs: { in: 3000, out: 3800 },

  css: (shown) => (shown ? { opacity: 1 } : { opacity: 0 }),

  elementStyle: (f: EffectFrame) => {
    const v = presence(f);
    // A soft front sweeping up the widget: opaque below it, clear above, with a
    // wide feather so there is never a line to see.
    const edge = v * 100;
    const mask =
      `linear-gradient(to top, #000 0%, #000 ${edge.toFixed(1)}%, ` +
      `transparent ${Math.min(100, edge + FEATHER).toFixed(1)}%)`;
    return {
      opacity: String(0.25 + 0.75 * v),
      maskImage: mask,
      webkitMaskImage: mask,
    } as Partial<CSSStyleDeclaration>;
  },

  init: () =>
    Array.from({ length: PUFFS }, (): Puff => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.22 + Math.random() * 0.42,
      vy: 0.10 + Math.random() * 0.22,
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
      if (q.y < -0.4) { q.y = 1.2; q.x = Math.random(); }
      // The box is where the smoke comes FROM, not where it stays: it is drawn
      // on the screensaver's own full-screen canvas, so a puff that rises past
      // the top keeps going instead of being clipped away.
      const px = f.width * q.x + Math.sin(f.now / 2600 + q.phase) * f.width * 0.22;
      const py = f.height * (q.y * 1.5 - 0.25);
      const rr = Math.min(f.width, f.height) * q.r;
      if (rr <= 0) continue;
      ctx.globalAlpha = 0.42 * strength;
      ctx.drawImage(puffSprite(), px - rr, py - rr, rr * 2, rr * 2);
    }
    ctx.restore();
  },
};
