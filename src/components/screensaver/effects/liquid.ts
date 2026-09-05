import type { EffectFrame, ScreensaverEffect } from './types';
import { effectPrefs } from '../screensaverPrefs';

/**
 * A waterline crossing the widget: it fills to arrive and drains to leave.
 *
 * The wave IS the boundary, not a decoration on one. The first version revealed
 * the widget with a CSS mask — a straight cut — and painted a wave over the top
 * of it, so the content actually appeared and disappeared along a flat line
 * while a crest undulated somewhere near it. The two never agreed, and that
 * disagreement is exactly what makes a thing look painted on.
 *
 * So the element is clipped to the wave itself. clip-path takes a polygon, a
 * polygon is just a list of points, and points can be recomputed every frame
 * for nothing — no mask image to re-parse, no gradient that refuses to
 * interpolate. The canvas then draws the water's body, its crest and its
 * bubbles from the SAME wave function, so the surface it draws is the surface
 * the widget is cut to.
 */
const WAVE_BAND = 26;      // px of drawn surface either side of the level
const BUBBLES = 14;
const POINTS = 48;         // polygon resolution along the crest

interface Bubble { x: number; y: number; r: number; v: number; seed: number }

/** Per-transition state: the bubbles, and how long the widget has been settled. */
interface Water { bubbles: Bubble[]; settled: number }

/**
 * How long the blue takes to drain out of a widget once it is full.
 *
 * The colour is the water, not the widget, so it has no business staying. It
 * follows the level on the way in — a half-full widget is half tinted — reaches
 * full strength as the pour finishes, and then leaves over five seconds, which
 * is slow enough that you never catch it going.
 */
const SETTLE_MS = 5000;

/**
 * The share of the transition spent before the level moves at all.
 *
 * The blue comes back during it. The colour is the water, so it should be there
 * before the water does anything — arriving at the same moment as the level
 * starts dropping makes the tint look like part of the animation rather than
 * like the thing that is about to move.
 *
 * Both directions wait, or the pour stops being a mirror: the widget filling
 * has to start when the widget draining starts.
 */
const POUR_START = 0.5;

/**
 * The body gradient, cached. It only depends on where the surface is, so it is
 * rebuilt when the level moves by more than a few pixels rather than 60 times a
 * second.
 */
let cachedFill: CanvasGradient | null = null;
let cachedKey = -1;
function bodyFill(ctx: CanvasRenderingContext2D, level: number, height: number): CanvasGradient {
  const key = Math.round(level / 8) * 1000 + Math.round(height);
  if (cachedFill && cachedKey === key) return cachedFill;
  const g = ctx.createLinearGradient(0, level, 0, height);
  g.addColorStop(0, 'rgba(125,180,225,0.20)');
  g.addColorStop(1, 'rgba(60,110,170,0.06)');
  cachedFill = g;
  cachedKey = key;
  return g;
}

/** Two components at different wavelengths, so the crest never repeats in a way
 *  the eye can catch. Shared by the clip and the drawing — that is the point. */
function waveAt(x: number, level: number, now: number, amp: number): number {
  return level
    + (Math.sin(x / 48 + now / 900) * 5
     + Math.sin(x / 19 - now / 1400) * 2) * amp;
}

/**
 * How far below the widget's top edge the surface settles when the glass is
 * full — and the reason the clip never bites.
 *
 * At full the level would otherwise sit exactly on the top edge, so a wave
 * swinging around it crosses the edge and the clip takes a bite out of the
 * widget and gives it back. The first fix damped the wave flat as it
 * approached full, which stopped the bite and cost the waves entirely, because
 * a settled widget IS full. The second kept the drawn surface waving but left
 * the clip damped — so near the top the crest you could see and the edge that
 * was actually cutting no longer agreed, and the disagreement flickered.
 *
 * Now there is one surface. It sits far enough below the top that a full swing
 * never reaches the edge, so nothing has to be damped and nothing can
 * disagree — the line you see IS the line that cuts. The inset scales with the
 * wobble setting, since a choppier surface needs more room.
 */
function settleInset(wobble: number): number {
  return 5 + 9 * wobble;
}

/**
 * How full, 0 to 1.
 *
 * One easing curve, used forwards to fill and backwards to drain, so the two
 * are exact mirrors: at any instant the water that has left one widget is the
 * water that has arrived in the other. Rotation swaps one out for one in, so a
 * drain always has a fill to pour into — but only if they move as one, and
 * separate curves (easeOut arriving, easeIn leaving) meant they did not. One
 * would still be half full while the other had finished.
 *
 * Smoothstep rather than an expo: eased at both ends, and symmetric, which is
 * what mirroring requires.
 */
const smoothstep = (t: number) => t * t * (3 - 2 * t);

function fillOf(f: { progress: number; phase: string }): number {
  const moving = Math.max(0, (f.progress - POUR_START) / (1 - POUR_START));
  const e = smoothstep(Math.min(1, moving));
  return f.phase === 'in' ? e : 1 - e;
}

/**
 * How blue it is, 0 to 1.
 *
 * Full while the level is moving. Before a drain it spends the first half of
 * the transition coming back, and once a widget has settled full it drains away
 * over five seconds and stays gone — the widget is then just a widget, with
 * water still moving over it but no colour in it.
 */
/**
 * The water easing on as the tide starts to rise.
 *
 * A pour used to begin with the surface, the crest and the bubbles all at full
 * strength on the first frame the level moved — the water did not arrive so
 * much as switch on. Ramping it over the first part of the rise lets the tide
 * come in from nothing, which is the only way it ever comes in.
 *
 * Only on the way in. A drain already ends with the widget gone, so the water
 * has somewhere to go on its own.
 */
function waterOn(f: EffectFrame): number {
  if (f.phase !== 'in') return 1;
  return Math.min(1, Math.max(0, (f.progress - POUR_START) / 0.25));
}

function tintOf(f: EffectFrame, settled: number): number {
  if (f.phase === 'out') return Math.min(1, f.progress / POUR_START);
  if (f.progress < 1) return 1;
  return Math.max(0, 1 - settled / SETTLE_MS);
}

/** Water level in px from the top: 0 is full, height is empty. */
function levelOf(f: { progress: number; phase: string; height: number }): number {
  return f.height * (1 - fillOf(f));
}

export const liquid: ScreensaverEffect = {
  id: 'liquid',
  label: 'Fill and drain',
  spread: 40,
  // It never stops moving, so it must not cost a full frame to do it.
  frameMs: 50,
  durationMs: { in: 10000, out: 10000 },

  // A full glass is still carbonated. Without this the surface froze the
  // instant the level arrived, which made the whole thing read as an animation
  // that had finished rather than as water sitting there.
  ambient: true,

  // At rest: whole when shown, gone when not. The transition does the rest.
  css: (shown) => (shown ? { opacity: 1 } : { opacity: 0 }),

  elementStyle: (f: EffectFrame) => {
    const level = levelOf(f);
    const { wobble } = effectPrefs();
    const pts: string[] = [];
    for (let i = 0; i <= POINTS; i++) {
      const x = (f.width * i) / POINTS;
      const y = waveAt(x, level + settleInset(wobble) * fillOf(f), f.now, wobble);
      pts.push(`${((x / f.width) * 100).toFixed(2)}% ${((y / f.height) * 100).toFixed(2)}%`);
    }
    pts.push('100% 100%', '0% 100%');
    return { opacity: '1', clipPath: `polygon(${pts.join(',')})` };
  },

  init: (): Water => ({
    settled: 0,
    bubbles: Array.from({ length: BUBBLES }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 1.5 + Math.random() * 3.5,
      v: 18 + Math.random() * 46,
      seed: Math.random() * 7,
    })),
  }),

  frame: (ctx, f: EffectFrame) => {
    const water = f.state as Water;
    if (!water) return;
    const bubbles = water.bubbles;
    const level = levelOf(f);
    const fill = fillOf(f);
    // The drawn surface keeps its full swing and sits just below the top once
    // the glass is full, so there is always water moving to look at.
    const { carbonation, wobble } = effectPrefs();
    const surface = level + settleInset(wobble) * fill;
    const waveY = (x: number) => waveAt(x, surface, f.now, wobble);

    if (f.progress >= 1 && f.phase === 'in') water.settled += f.dt;
    const arriving = waterOn(f);
    const tint = tintOf(f, water.settled) * arriving;

    ctx.save();

    // The body of the water — the only part that carries the colour, and so the
    // only part that drains away. The surface and the bubbles keep going for as
    // long as the widget is up: it was the blue that outstayed its welcome, not
    // the water.
    //
    // Skipped outright once the tint is gone, which also settles what used to be
    // the most expensive thing on this canvas: four settled widgets each
    // compositing a translucent fill across their whole area, every frame. The
    // gradient is cached and the path is coarse for the same reason.
    if (tint > 0.004) {
      ctx.globalAlpha = tint;
      ctx.beginPath();
      ctx.moveTo(0, f.height);
      for (let x = 0; x <= f.width; x += 16) ctx.lineTo(x, waveY(x));
      ctx.lineTo(f.width, waveY(f.width));
      ctx.lineTo(f.width, f.height);
      ctx.closePath();
      ctx.fillStyle = bodyFill(ctx, surface, f.height);
      ctx.fill();
    }

    if (carbonation) for (const bub of bubbles) {
      bub.y -= (bub.v * f.dt) / 1000 / f.height;
      if (bub.y < 0) { bub.y = 1; bub.x = Math.random(); }
      const by = surface + (f.height - surface) * bub.y;
      if (by <= surface + 2 || by >= f.height) continue;
      const bx = f.width * bub.x + Math.sin(f.now / 700 + bub.seed) * 3;
      ctx.beginPath();
      ctx.arc(bx, by, bub.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.globalAlpha = arriving;
      ctx.fill();
    }

    // The crest. This is the line the widget is actually cut along, which is
    // why it can be drawn hard: there is nothing behind it to give it away.
    // Drawn whenever there is any water at all, full included — the surface of
    // a full glass is at its top edge, and it still moves.
    if (fill > 0.002) {
      ctx.beginPath();
      for (let x = 0; x <= f.width; x += 12) {
        const y = waveY(x);
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      // Faded out at both ends rather than run hard to the edges.
      //
      // Widgets sit directly above and below one another, so two crests can end
      // up a few pixels apart with nothing between them — and two hard lines
      // that close together read as one double line rather than as two
      // surfaces. Easing each to transparent at its ends leaves the middle of
      // the wave, which is the part worth seeing, and lets the ends stop being
      // anything in particular.
      const fade = ctx.createLinearGradient(0, 0, f.width, 0);
      fade.addColorStop(0, 'rgba(226,242,255,0)');
      fade.addColorStop(0.18, 'rgba(226,242,255,0.55)');
      fade.addColorStop(0.82, 'rgba(226,242,255,0.55)');
      fade.addColorStop(1, 'rgba(226,242,255,0)');
      ctx.globalAlpha = arriving;
      ctx.strokeStyle = fade;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    ctx.restore();
  },
};
