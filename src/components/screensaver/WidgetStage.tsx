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
        const s0 = effect.elementStyle?.(0, phase) ?? null;
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
        onProgress: (p) => {
          if (!liveEl) return;
          const s = effect.elementStyle?.(p, phase) ?? null;
          if (s) Object.assign(liveEl.style, s);
          if (effect.takesOverAt !== undefined) {
            liveEl.style.visibility = p >= effect.takesOverAt ? 'hidden' : '';
          }
        },
        onDone: () => {
          if (!liveEl) return;
          liveEl.style.transform = '';
          liveEl.style.visibility = '';
        },
      });
    };

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
      if (liveEl) { liveEl.style.transform = ''; liveEl.style.visibility = ''; }
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
