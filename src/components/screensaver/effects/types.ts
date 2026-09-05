import type { CSSProperties } from 'react';

/**
 * One screensaver transition, as a thing the stage can run.
 *
 * There are two families here and the interface has to host both, because the
 * four effects are not variations of one technique:
 *
 *   fade      — opacity
 *   fill/drain— a waterline, i.e. a moving mask
 *   smoke     — a feathered mask, plus drifting puffs that owe nothing to the
 *               widget's content
 *   fireworks — the widget's OWN pixels, each one thrown separately
 *
 * The first three are declarative: name the resting styles and let CSS tween
 * between them, which keeps them on the compositor and costs nothing. Only the
 * last one needs a frame loop and the widget's actual pixels, so only it pays
 * for them. An effect says which parts it wants and the stage provides exactly
 * those.
 */
export type EffectPhase = 'in' | 'out';

export interface EffectFrame {
  /** 0 → 1 across the current transition. */
  progress: number;
  phase: EffectPhase;
  /** The widget box, in CSS pixels. */
  width: number;
  height: number;
  /** ms since the previous frame. */
  dt: number;
  now: number;
  /** The widget's own pixels — only when the effect asked for them. */
  pixels: ImageData | null;
  /** Whatever init() returned: particles, puffs, whatever the effect keeps. */
  state: unknown;
}

export interface ScreensaverEffect {
  id: string;
  label: string;
  /** How long the transition runs. Arriving and leaving are rarely equal. */
  durationMs: { in: number; out: number };
  /**
   * Capture the widget's pixels before an outgoing transition. Costs a
   * rasterisation (~13ms for a typical widget), so only fireworks asks.
   */
  needsPixels?: boolean;
  /**
   * Progress at which the canvas becomes the widget and the live element is
   * hidden. Before this point you are looking at the real thing; after it, at
   * its pixels. Omit for effects that never take over.
   *
   * It is a threshold rather than a flag because fireworks holds and swells
   * BEFORE it bursts, and that swell should be the actual widget — swapping in
   * the snapshot early means any imperfection in it is on screen, full size,
   * for the most conspicuous second of the effect.
   */
  takesOverAt?: number;
  /** Resting styles for the shown and hidden states; CSS does the tween. */
  css?: (shown: boolean) => CSSProperties;
  /**
   * Fade the widget's card fill and border away for the duration, so what is
   * left is the content rather than a rectangle. Applied on the way out and
   * released on the way in, both slowly.
   */
  shedsCard?: boolean;
  /**
   * Applied to the live element ONCE, when the transition starts.
   *
   * For anything better handed to the compositor than driven from our frame
   * loop — a CSS animation, say. Per-frame writes are only ever as smooth as
   * the loop behind them, which on a slow machine is not smooth at all.
   */
  startStyle?: (phase: EffectPhase, durationMs: number) => Partial<CSSStyleDeclaration> | null;
  /**
   * Per-frame styles for the LIVE element, applied imperatively so driving them
   * costs no React render. Return null when there is nothing to apply.
   *
   * Gets the whole frame because an effect that shapes the element — clipping
   * it to a waterline, say — needs the box and the clock, not just how far
   * through it is.
   */
  elementStyle?: (f: EffectFrame) => Partial<CSSStyleDeclaration> | null;
  /** Allocate per-transition state. */
  init?: (f: Omit<EffectFrame, 'state'>) => unknown;
  /** Draw onto a canvas laid over the widget. */
  frame?: (ctx: CanvasRenderingContext2D, f: EffectFrame) => void;
  /**
   * How far beyond its widget this effect draws, in px. The stage clears only
   * the area an effect can reach, so anything drawn outside this is left on
   * screen as a smear.
   */
  spread?: number;
  /**
   * Keep drawing once the widget has settled, with progress pinned at 1. For
   * anything whose resting state is still in motion — a full glass is still
   * carbonated — rather than a freeze-frame of the last transition.
   */
  ambient?: boolean;
}

/** Penner. Arriving settles; leaving holds and then goes. */
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const easeInExpo = (t: number) => (t <= 0 ? 0 : Math.pow(2, 10 * (t - 1)));
