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
 * The widget comes through the smoke, rather than up out of it.
 *
 * The mask used to be a horizontal front sliding up the widget — which is the
 * waterline again, and made smoke look like a second fill-and-drain. Smoke has
 * no level. It has patches: thin somewhere, thick somewhere else, and the thing
 * behind it shows through wherever it happens to be thin.
 *
 * So the mask is a handful of soft blobs that grow from nothing until they
 * merge, at fixed positions but different rates. The widget appears in pieces
 * that join up, and leaves the same way in reverse. A last flat layer fades in
 * over the final quarter, because a union of circles reaches "almost all of the
 * widget" long before it reaches all of it, and the last few percent would
 * otherwise linger as odd gaps.
 */
const BLOBS: Array<[number, number, number]> = [
  // x%, y%, how fast this one opens relative to the others
  [26, 32, 1.00],
  [72, 28, 0.86],
  [46, 66, 0.94],
  [82, 74, 0.78],
  [16, 78, 0.90],
  [58, 46, 1.06],
];

function cloudMask(progress: number, width: number, height: number): string {
  const diag = Math.hypot(width, height);
  const p = Math.max(0, Math.min(1, progress));
  const layers = BLOBS.map(([x, y, rate]) => {
    const r = Math.max(0.5, Math.pow(p, 0.85) * rate * diag * 0.62);
    return `radial-gradient(circle ${r.toFixed(1)}px at ${x}% ${y}%, `
      + '#000 0%, rgba(0,0,0,0.72) 58%, transparent 100%)';
  });
  // the closer: fills the last gaps so the widget ends up whole
  const flat = Math.max(0, (p - 0.72) / 0.28);
  layers.push(`linear-gradient(rgba(0,0,0,${flat.toFixed(3)}), rgba(0,0,0,${flat.toFixed(3)}))`);
  return layers.join(', ');
}

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
    const mask = cloudMask(presence(f), f.width, f.height);
    // Opacity is deliberately NOT touched. Fading the widget at the same time
    // as masking it is two departures at once, and the fade is the one you
    // notice — which is why this mode read as a plain fade with haze over it.
    // The mask is the whole effect.
    return {
      opacity: '1',
      maskImage: mask,
      webkitMaskImage: mask,
      maskRepeat: 'no-repeat',
      webkitMaskRepeat: 'no-repeat',
      maskComposite: 'add',
      webkitMaskComposite: 'source-over',
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
