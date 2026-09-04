'use client';

import { useEffect, useRef, useState } from 'react';
import type { EffectFrame, ScreensaverEffect } from './effects';
import { rasterize, warmRasterCache } from './effects';

/**
 * One widget's slot in the screensaver, and the thing that runs its transition.
 *
 * The stage owns the parts an effect might want and hands over only the ones it
 * asked for: resting styles for the CSS-driven effects, and — for the one
 * effect that needs them — the widget's own pixels plus a canvas and a frame
 * clock. An effect that declares neither costs nothing beyond a style object.
 */
export function WidgetStage({
  effect,
  shown,
  prepare,
  className,
  children,
}: {
  effect: ScreensaverEffect | null;
  shown: boolean;
  /** Last-moment changes to the snapshot only — never to the live widget. */
  prepare?: (clone: HTMLElement) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [painting, setPainting] = useState(false);
  const first = useRef(true);

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
    if (!effect?.frame) return;

    const phase = shown ? 'in' : 'out';
    const duration = effect.durationMs[phase];
    let raf = 0;
    let cancelled = false;
    let last = performance.now();
    const t0 = last;

    const run = (pixels: ImageData | null) => {
      if (cancelled) return;
      const el = canvas.current;
      const box = host.current?.getBoundingClientRect();
      if (!el || !box) return;
      const width = Math.round(box.width);
      const height = Math.round(box.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      el.width = Math.max(1, Math.round(width * dpr));
      el.height = Math.max(1, Math.round(height * dpr));
      const ctx = el.getContext('2d');
      if (!ctx) return;

      const base: Omit<EffectFrame, 'state'> = {
        progress: 0, phase, width, height, dt: 0, now: t0, pixels,
      };
      const state = effect.init?.(base) ?? null;
      setPainting(true);

      const step = (now: number) => {
        if (cancelled) return;
        const progress = Math.min(1, (now - t0) / duration);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        effect.frame!(ctx, {
          progress, phase, width, height, dt: now - last, now, pixels, state,
        });

        // The live element's part of the transition: per-frame styles, and the
        // moment it hands over to the canvas.
        const el = live.current;
        if (el) {
          const s = effect.elementStyle?.(progress, phase) ?? null;
          if (s) Object.assign(el.style, s);
          else if (effect.elementStyle) el.style.transform = '';
          if (effect.takesOverAt !== undefined) {
            el.style.visibility = progress >= effect.takesOverAt ? 'hidden' : '';
          }
        }
        last = now;
        if (progress < 1) raf = requestAnimationFrame(step);
        else setPainting(false);
      };
      raf = requestAnimationFrame(step);
    };

    if (effect.needsPixels && phase === 'out' && host.current) {
      // Capture with the material class on, so there is something to throw:
      // a screensaver widget at rest is about 97% transparent pixels.
      const el = host.current;
      rasterize(el, prepare)
        .then((pixels) => run(pixels))
        .catch(() => { /* a widget we cannot snapshot simply skips the effect */ });
    } else {
      run(null);
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      setPainting(false);
      const el = live.current;
      if (el) { el.style.visibility = ''; el.style.transform = ''; }
    };
  }, [shown, effect, prepare]);

  // The canvas must sit exactly over the widget, and must never eat a tap —
  // the calendar's on-screensaver controls are underneath it.


  return (
    <div ref={host} className="relative h-full w-full">
      <div ref={live} style={effect?.css?.(shown) ?? {}} className={className}>
        {children}
      </div>
      {effect?.frame && (
        <canvas
          ref={canvas}
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ display: painting ? 'block' : 'none' }}
        />
      )}
    </div>
  );
}
