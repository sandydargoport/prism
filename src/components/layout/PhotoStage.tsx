'use client';

/**
 * One photo stage for the wallpaper and the screensaver (#954).
 *
 * A true crossfade: the photo on screen stays fully opaque underneath while
 * the next one fades in over it, so the picture never dips towards the black
 * behind it (fading both layers at once would). The next photo is decoded
 * before its fade starts, so a slow load never shows a blank or half-drawn
 * frame. Under reduced motion the fade is short.
 *
 * Each photo also zooms slowly over its whole time on screen (#955), in or
 * out by turns, anchored on its focal point (#956). Off under reduced motion
 * and below the full performance level; each swap is timed like the idle
 * fade, so a screen that cannot keep up steps down and loses the zoom.
 */
import { useEffect, useRef, useState } from 'react';
import { CENTRED, type Frame } from '@/lib/photos/frame';
import { zoomFor, zoomOn, zoomOrigin } from '@/lib/photos/zoom';
import { judgeMotion, usePerformanceLevel } from '@/lib/hooks/usePerformanceMode';

export const CROSSFADE_MS = 2200;
export const REDUCED_FADE_MS = 300;
/** When a photo is framed again, once the widgets are drawn (#957). */
export const REFRAME_MS = 1500;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Resolves once the image is decoded and ready to paint. */
function decoded(src: string): Promise<void> {
  const img = new Image();
  img.src = src;
  if (typeof img.decode === 'function') return img.decode();
  return new Promise((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject; });
}

export function PhotoStage({ src, className = '', frameFor, zoomMs = 0 }: {
  src: string | null;
  className?: string;
  /**
   * How a photo is framed: its crop and where its subject lands (#957).
   * Asked once, when the photo arrives, so it can measure the widgets then.
   */
  frameFor?: (src: string) => Frame;
  /** How long each photo is on screen, for the zoom; 0 for no zoom. */
  zoomMs?: number;
}) {
  const level = usePerformanceLevel();
  const zooming = zoomMs > 0 && zoomOn(level, prefersReducedMotion());
  // Per photo: which way it zooms and where it is anchored, fixed when it
  // first arrives so a re-render never restarts or flips it.
  const shown = useRef(new Map<string, { n: number; frame: Frame }>());
  const count = useRef(0);
  const started = useRef(new WeakSet<Element>());
  const [front, setFront] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<{ src: string; shown: boolean } | null>(null);
  const frontRef = useRef<string | null>(null);
  useEffect(() => { frontRef.current = front; }, [front]);
  const fadeMs = prefersReducedMotion() ? REDUCED_FADE_MS : CROSSFADE_MS;

  useEffect(() => {
    if (!src || src === frontRef.current) return;
    // Fixed now, before its layer exists: a re-render never flips or restarts it.
    if (!shown.current.has(src)) {
      shown.current.set(src, { n: count.current++, frame: frameFor?.(src) ?? CENTRED });
      if (shown.current.size > 8) shown.current.delete(shown.current.keys().next().value!);
    }
    let cancelled = false;
    let raf = 0;
    decoded(src).then(() => {
      if (cancelled) return;
      // The first photo has nothing under it: it simply appears (the page
      // or overlay around it does its own fade in).
      if (frontRef.current === null) { frontRef.current = src; setFront(src); return; }
      setIncoming({ src, shown: false });
      // Two frames so the browser paints it transparent before it fades in.
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => {
          if (cancelled) return;
          setIncoming({ src, shown: true });
          // The swap, with its zoom, is the screen's heaviest moment: time it.
          judgeMotion();
        });
      });
    }).catch(() => {
      // Undecodable: keep what is on screen; the caller's validator skips it.
    });
    return () => { cancelled = true; cancelAnimationFrame(raf); };
    // Only a new photo starts this; its frame is read with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Once per layer, when it is attached: the crop it was given when it
  // arrived (#957), then its zoom (#955) anchored where its subject landed.
  const setUp = (url: string) => (el: HTMLDivElement | null) => {
    if (!el || started.current.has(el)) return;
    started.current.add(el);
    const info = shown.current.get(url) ?? { n: 0, frame: CENTRED };
    const apply = (f: Frame) => {
      el.style.backgroundPosition = `${f.position.x.toFixed(1)}% ${f.position.y.toFixed(1)}%`;
      el.style.transformOrigin = zoomOrigin(f.origin);
      el.dataset.subjectX = f.origin.x.toFixed(3);
      el.dataset.subjectY = f.origin.y.toFixed(3);
    };
    apply(info.frame);
    // After a page load the first photo can arrive before the widgets are
    // drawn, so it was framed against an empty screen. Frame it again once
    // they are up; on a load that happens while everything is appearing.
    if (frameFor) {
      setTimeout(() => {
        if (!el.isConnected) return;
        const again = frameFor(url);
        if (again.position.x === info.frame.position.x && again.position.y === info.frame.position.y) return;
        info.frame = again;
        apply(again);
      }, REFRAME_MS);
    }
    if (!zooming || typeof el.animate !== 'function') return;
    const [from, to] = zoomFor(info.n);
    el.animate([{ transform: `scale(${from})` }, { transform: `scale(${to})` }], {
      duration: zoomMs + fadeMs, easing: 'linear', fill: 'forwards',
    });
  };

  const layer = (key: string, url: string, role: 'front' | 'incoming', opacity: number) => (
    <div
      key={key}
      ref={setUp(url)}
      data-zoom={zooming ? 'on' : 'off'}
      className="absolute inset-0 bg-cover bg-center"
      style={{ backgroundImage: `url(${url})`, opacity, transition: role === 'incoming' ? `opacity ${fadeMs}ms linear` : undefined }}
      data-photo-layer={role}
      onTransitionEnd={role === 'incoming' ? () => { setFront(url); setIncoming(null); } : undefined}
    />
  );

  return (
    <div className={`pointer-events-none absolute inset-0 ${className}`} data-photo-stage>
      {/* One keyed list, so the photo that finishes fading in stays the
          same element when it becomes the front one (no remount, no flash). */}
      {src && [
        front ? layer(front, front, 'front', 1) : null,
        // Only the photo asked for now fades in; a stale one is dropped.
        incoming && incoming.src === src && incoming.src !== front ? layer(incoming.src, incoming.src, 'incoming', incoming.shown ? 1 : 0) : null,
      ]}
    </div>
  );
}
