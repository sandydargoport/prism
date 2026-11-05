'use client';

/**
 * One photo stage for the wallpaper and the screensaver (#954).
 *
 * A true crossfade: the photo on screen stays fully opaque underneath while
 * the next one fades in over it, so the picture never dips towards the black
 * behind it (fading both layers at once would). The next photo is decoded
 * before its fade starts, so a slow load never shows a blank or half-drawn
 * frame. Under reduced motion the fade is short.
 */
import { useEffect, useRef, useState } from 'react';

export const CROSSFADE_MS = 2200;
export const REDUCED_FADE_MS = 300;

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

export function PhotoStage({ src, className = '' }: { src: string | null; className?: string }) {
  const [front, setFront] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<{ src: string; shown: boolean } | null>(null);
  const frontRef = useRef<string | null>(null);
  useEffect(() => { frontRef.current = front; }, [front]);
  const fadeMs = prefersReducedMotion() ? REDUCED_FADE_MS : CROSSFADE_MS;

  useEffect(() => {
    if (!src || src === frontRef.current) return;
    let cancelled = false;
    let frame = 0;
    decoded(src).then(() => {
      if (cancelled) return;
      // The first photo has nothing under it: it simply appears (the page
      // or overlay around it does its own fade in).
      if (frontRef.current === null) { frontRef.current = src; setFront(src); return; }
      setIncoming({ src, shown: false });
      // Two frames so the browser paints it transparent before it fades in.
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => { if (!cancelled) setIncoming({ src, shown: true }); });
      });
    }).catch(() => {
      // Undecodable: keep what is on screen; the caller's validator skips it.
    });
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [src]);

  const layer = (key: string, url: string, role: 'front' | 'incoming', opacity: number) => (
    <div
      key={key}
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
