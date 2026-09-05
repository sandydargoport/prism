'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ScreensaverEffect } from './effects';
import { rasterize, warmRasterCache } from './effects';
import { scaledDuration } from './screensaverPrefs';
import { useEffectStage } from './EffectStage';

/**
 * One widget's slot in the screensaver.
 *
 * The stage owns the canvas and the clock; this owns the live element. When a
 * transition starts it hands the shared stage everything the effect asked for —
 * the widget's box on screen, and its pixels if the effect needs them — and
 * drives the live element as the effect dictates.
 */
/** Everything a transition is allowed to write to the live element. */
const SHED_CLASSES = ['prism-breath', 'prism-shed'] as const;

const DRIVEN = [
  'opacity', 'transform', 'visibility', 'clipPath', 'transition',
  'animation', 'animationDuration', 'willChange',
  'maskImage', 'webkitMaskImage', 'maskSize', 'webkitMaskSize',
  'maskRepeat', 'webkitMaskRepeat', 'maskPosition', 'webkitMaskPosition',
] as const;

/**
 * Put the element back to its resting state.
 *
 * Clearing cssText wholesale is wrong: it drops opacity back to its default of
 * 1 for the moment before the resting value is reapplied, so a widget that is
 * supposed to be gone flashes into view. Only the properties a transition
 * actually drives are cleared, and only the ones the resting state does not set
 * for itself.
 */
function applyResting(el: HTMLElement, resting: React.CSSProperties) {
  for (const c of SHED_CLASSES) el.classList.remove(c);
  for (const prop of DRIVEN) {
    if (!(prop in (resting as Record<string, unknown>))) {
      (el.style as unknown as Record<string, string>)[prop] = '';
    }
  }
  Object.assign(el.style, resting);
}

export function WidgetStage({
  id,
  effect,
  shown,
  prepare,
  className,
  children,
}: {
  id: string;
  effect: ScreensaverEffect | null;
  shown: boolean;
  /** Last-moment changes to the snapshot only — never to the live widget. */
  prepare?: (clone: HTMLElement) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const stage = useEffectStage();
  const [busy, setBusy] = useState(false);
  /** Read synchronously by the resting-style effect, which must not fight a
   *  transition that is already driving this element. */
  const busyRef = useRef(false);
  /** The effect this element was last styled for. */
  const lastEffect = useRef<ScreensaverEffect | null>(null);

  // Fetch and encode the widget's fonts now, while it is sitting still, rather
  // than at the instant it is meant to burst.
  useEffect(() => {
    if (effect?.needsPixels) warmRasterCache(host.current);
  }, [effect]);

  // `shown` flipping is what starts a transition. The first render is the
  // resting state, not a transition — animating it would play every effect at
  // once the moment the screensaver opens.
  //
  // Layout effect, not effect: React has already rendered the resting hidden
  // state by the time this runs, and a plain effect runs AFTER the browser
  // paints — so the widget was painted invisible for one frame before the
  // wind-up took hold of it. That single frame is the flash.
  useLayoutEffect(() => {
    if (first.current) { first.current = false; return; }
    // An effect earns a transition by driving something — a canvas frame, a
    // per-frame style, or a one-off style at the start. Gating on `frame` alone
    // meant an effect that only drives the element (smoke, once its canvas
    // puffs were removed) silently stopped transitioning at all and degraded
    // into the plain fade underneath it.
    const drives = effect?.frame || effect?.elementStyle || effect?.startStyle;
    if (!effect || !drives || !stage) return;

    const phase = shown ? 'in' : 'out';
    const el = host.current;
    const liveEl = live.current;
    if (!el) return;

    let cancel: (() => void) | null = null;
    let dropped = false;

    /**
     * Hand the element back to React.
     *
     * Every property elementStyle touched has to go, opacity above all: the
     * effects hold it at 1 for the duration, and leaving that behind beat the
     * rendered resting state — so a widget that had just drained away popped
     * straight back into view, fully opaque, and the board never emptied.
     */
    const release = () => {
      if (!liveEl) return;
      applyResting(liveEl, effect.css?.(shown) ?? {});
    };

    const start = (pixels: ImageData | null) => {
      if (dropped) return;
      // Anything better handed to the compositor than driven from our frame
      // loop, applied once. The breath is a CSS animation for exactly this
      // reason: a slow, one-percent motion cannot hide a dropped frame.
      const box = el.getBoundingClientRect();
      busyRef.current = true;
      setBusy(true);
      cancel = stage.begin(`${id}:${phase}`, {
        effect,
        phase,
        viewportLeft: box.left,
        viewportTop: box.top,
        width: Math.round(box.width),
        height: Math.round(box.height),
        pixels,
        onFrame: (f) => {
          if (!liveEl) return;
          const s = effect.elementStyle?.(f) ?? null;
          if (s) Object.assign(liveEl.style, s);
          // Only hand over when the canvas actually holds this widget's
          // pixels. Applying the threshold on the arriving side too hid a
          // widget that was busy fading IN, and left it hidden — with nothing
          // drawn in its place, because there was no snapshot to draw.
          if (effect.takesOverAt !== undefined && f.pixels) {
            liveEl.style.visibility = f.progress >= effect.takesOverAt ? 'hidden' : '';
          }
        },
        onDone: () => { busyRef.current = false; setBusy(false); release(); },
      });
    };

    // Everything the element needs, applied NOW — before the snapshot, not
    // after it.
    //
    // The resting hidden state is already on the element by the time this runs,
    // and capturing a widget takes a beat. Doing this afterwards left it
    // invisible for the whole capture: it blinked out, came back for the
    // wind-up, and then burst. That was the flash at the start of the sequence.
    // The wind-up should begin the moment the widget is dropped, which is also
    // simply when it ought to begin.
    if (liveEl) {
      if (effect.shedsCard) {
        // Out: drop the card. In: put it back, at the same unhurried pace.
        if (phase === 'out') liveEl.classList.add('prism-shed');
        else liveEl.classList.remove('prism-shed');
      }
      const once = effect.startStyle?.(phase, scaledDuration(effect.durationMs[phase])) ?? null;
      if (once) {
        Object.assign(liveEl.style, once);
        if (once.animationDuration) liveEl.classList.add('prism-breath');
      }
      const box0 = el.getBoundingClientRect();
      const hold = effect.elementStyle?.({
        progress: 0, phase, width: Math.round(box0.width), height: Math.round(box0.height),
        dt: 0, now: performance.now(), pixels: null, state: null,
      }) ?? null;
      if (hold) Object.assign(liveEl.style, hold);
    }

    if (effect.needsPixels && phase === 'out') {
      rasterize(el, prepare)
        .then(start)
        .catch(() => { /* a widget we cannot snapshot simply skips the effect */ });
    } else {
      start(null);
    }

    return () => {
      dropped = true;
      cancel?.();
      busyRef.current = false;
      setBusy(false);
      release();
    };
  }, [shown, effect, stage, id, prepare]);

  /**
   * The resting state, applied imperatively.
   *
   * It used to be a style prop, and that is a race: a transition holds opacity
   * at 1 by writing straight to the element, and ANY re-render of this
   * component — the ambient bookkeeping causes one — re-applies the rendered
   * resting state over the top and blanks the widget until the next frame
   * restores it. One frame is all it takes; that was the flash still showing up
   * just before the wind-up. React no longer writes to this element at all.
   */
  useLayoutEffect(() => {
    const el = live.current;
    if (!el) return;
    // Changing effect always wins over a transition in flight. Otherwise a
    // widget caught mid-transition keeps whatever the OLD effect had written to
    // it — a clip-path shaped like a waterline, say — and holds that shape,
    // frozen, until it next happens to cycle. Within one effect, a running
    // transition owns the element and this stays out of its way.
    const changed = lastEffect.current !== effect;
    lastEffect.current = effect;
    if (busyRef.current && !changed) return;
    applyResting(el, effect?.css?.(shown) ?? {});
  }, [effect, shown]);

  // The resting state, for effects whose resting state still moves. Held open
  // only once the widget has settled, or it would draw a second waterline on
  // top of the one the transition is still moving.
  useEffect(() => {
    if (!stage || !effect?.ambient || !shown || busy) return;
    const el = host.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    return stage.begin(`${id}:ambient`, {
      effect,
      phase: 'in',
      viewportLeft: box.left,
      viewportTop: box.top,
      width: Math.round(box.width),
      height: Math.round(box.height),
      pixels: null,
      persistent: true,
      onFrame: () => {},
      onDone: () => {},
    });
  }, [stage, effect, shown, busy, id]);

  return (
    <div ref={host} className="h-full w-full">
      <div ref={live} className={className}>
        {children}
      </div>
    </div>
  );
}
