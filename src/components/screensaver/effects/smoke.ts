import type { EffectFrame, ScreensaverEffect } from './types';

/**
 * Smoke thins out and it gathers, and the two are not mirror images.
 *
 * Two parts, because smoke is not one thing:
 *
 *  - A feathered boundary sweeping the widget. Same mask-position trick as the
 *    waterline, but the gradient is three widget-heights tall with a very long
 *    ramp, so there is no line anywhere — just a region that has not arrived
 *    yet. Using the liquid's tight feather here made it look like a bucket with
 *    the waterline hidden, which is exactly what it should not look like.
 *
 *  - Drifting puffs over the top. These owe nothing to the widget's content —
 *    they are volume in front of it — so this effect never needs the widget's
 *    pixels, only a canvas to draw on. They rise, wander, and are strongest in
 *    the middle of the transition, where the widget is half gone.
 */
const MASK =
  'linear-gradient(to top, #000 0%, #000 34%, rgba(0,0,0,0.45) 50%, transparent 66%, transparent 100%)';

const PUFFS = 26;

/**
 * One puff, drawn once.
 *
 * Building a radial gradient per puff per frame — sixteen of them, sixty times
 * a second — cost more than everything else in the screensaver put together:
 * measured 30fps with a 100ms 95th percentile. A gradient's shape never changes
 * here, only its size and opacity, so it is rendered once into an offscreen
 * canvas and stamped with drawImage after that.
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

interface Puff { x: number; y: number; r: number; vy: number; phase: number }

export const smoke: ScreensaverEffect = {
  id: 'smoke',
  label: 'Smoke',
  durationMs: { in: 2600, out: 3400 },

  css: (shown) => ({
    WebkitMaskImage: MASK,
    maskImage: MASK,
    WebkitMaskSize: '100% 300%',
    maskSize: '100% 300%',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: shown ? '0% 100%' : '0% 0%',
    maskPosition: shown ? '0% 100%' : '0% 0%',
    transition:
      `mask-position ${shown ? 2.6 : 3.4}s cubic-bezier(.4,0,.5,1), ` +
      `-webkit-mask-position ${shown ? 2.6 : 3.4}s cubic-bezier(.4,0,.5,1)`,
    opacity: 1,
  }),

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
    // Densest halfway through, gone at either end — smoke should not appear
    // from nothing or outlive the thing it came off.
    const strength = Math.sin(Math.PI * Math.min(1, Math.max(0, f.progress)));
    if (strength <= 0.01) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const q of puffs) {
      q.y -= (q.vy * f.dt) / 1000;
      if (q.y < -0.4) { q.y = 1.2; q.x = Math.random(); }
      // The box is where the smoke comes FROM, not where it stays: it is drawn
      // on the screensaver's own full-screen canvas, so a puff that rises past
      // the top of the widget keeps going instead of being clipped away.
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
