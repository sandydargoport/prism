'use client';

import { useEffect, useRef } from 'react';
import type { ScreensaverEffect } from './effects';
import { rasterize, warmRasterCache } from './effects';
import { useEffectStage } from './EffectStage';

/**
 * One widget's slot in the screensaver.
 *
 * The stage owns the canvas and the clock; this owns the live element. When a
 * transition starts it hands the shared stage everything the effect asked for —
 * the widget's box on screen, and its pixels if the effect needs them — and
 * drives the live element as the effect dictates.
 */
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

  // Fetch and encode the widget's fonts now, while it is sitting still, rather
  // than at the instant it is meant to burst.
  useEffect(() => {
    if (effect?.needsPixels) warmRasterCache(host.current);
  }, [effect]);

  // `shown` flipping is what starts a transition. The first render is the
  // resting state, not a transition — animating it would play every effect at
  // once the moment the screensaver opens.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!effect?.frame || !stage) return;

    const phase = shown ? 'in' : 'out';
    const el = host.current;
    const liveEl = live.current;
    if (!el) return;

    let cancel: (() => void) | null = null;
    let dropped = false;

    const start = (pixels: ImageData | null) => {
      if (dropped) return;
      // Apply frame zero before handing over, or the element spends one frame
      // in its resting hidden state — a visible blink right before the swell.
      if (liveEl) {
        const s0 = effect.elementStyle?.({
          progress: 0, phase, width: Math.round(el.getBoundingClientRect().width),
          height: Math.round(el.getBoundingClientRect().height),
          dt: 0, now: performance.now(), pixels, state: null,
        }) ?? null;
        if (s0) Object.assign(liveEl.style, s0);
      }
      const box = el.getBoundingClientRect();
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
        onDone: () => {
          if (!liveEl) return;
          liveEl.style.transform = '';
          liveEl.style.visibility = '';
          liveEl.style.clipPath = '';
        },
      });
    };

    if (effect.needsPixels && phase === 'out') {
      // Hold the widget exactly as it was until the transition can actually
      // begin. Rasterising takes a beat, and React has already applied the
      // resting hidden state by now — without this the widget blinks out,
      // comes back for the swell, and then bursts, which looks like a fault
      // rather than a wind-up.
      if (liveEl) {
        const box0 = el.getBoundingClientRect();
        const hold = effect.elementStyle?.({
          progress: 0, phase, width: Math.round(box0.width), height: Math.round(box0.height),
          dt: 0, now: performance.now(), pixels: null, state: null,
        }) ?? null;
        if (hold) Object.assign(liveEl.style, hold);
      }
      rasterize(el, prepare)
        .then(start)
        .catch(() => { /* a widget we cannot snapshot simply skips the effect */ });
    } else {
      start(null);
    }

    return () => {
      dropped = true;
      cancel?.();
      if (liveEl) {
        liveEl.style.transform = '';
        liveEl.style.visibility = '';
        liveEl.style.clipPath = '';
      }
    };
  }, [shown, effect, stage, id, prepare]);

  return (
    <div ref={host} className="h-full w-full">
      <div ref={live} style={effect?.css?.(shown) ?? {}} className={className}>
        {children}
      </div>
    </div>
  );
}
