'use client';

/**
 * An event title that slides when it is too long for its event (#901),
 * instead of being cut. At rest it is cut with an ellipsis, as before; when
 * the shared queue gives it a turn it rests, slides to its end at about
 * 30px/s, rests, and slides back. Under reduced motion it never slides.
 * The text keeps its size throughout.
 */
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { slideDuration, slideQueue, SLIDE } from '@/lib/calendar/slideQueue';

export function SlidingTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  const outer = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [distance, setDistance] = useState(0);
  const [sliding, setSliding] = useState(false);

  useEffect(() => {
    const el = outer.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => setDistance(Math.max(0, Math.ceil(el.scrollWidth - el.clientWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);

  useEffect(() => {
    if (distance < 2 || typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let animation: Animation | undefined;
    const leave = slideQueue.join(async () => {
      const el = inner.current;
      if (!el?.animate) return;
      setSliding(true);
      // A transform needs a box; set here, not by state, so the first frame moves.
      el.style.display = 'inline-block';
      const total = slideDuration(distance);
      const rest = SLIDE.pauseMs / total;
      const travel = (1 - 2 * rest) / 2;
      animation = el.animate([
        { transform: 'translateX(0)', offset: 0 },
        { transform: 'translateX(0)', offset: rest },
        { transform: `translateX(-${distance}px)`, offset: rest + travel },
        { transform: `translateX(-${distance}px)`, offset: 2 * rest + travel },
        { transform: 'translateX(0)', offset: 1 },
      ], { duration: total, easing: 'linear' });
      try { await animation.finished; } finally { el.style.display = ''; setSliding(false); }
    });
    return () => { leave(); animation?.cancel(); };
  }, [distance]);

  return (
    <span
      ref={outer}
      className={cn('block min-w-0 overflow-hidden whitespace-nowrap', sliding ? 'text-clip' : 'text-ellipsis', className)}
      data-sliding-title={distance >= 2 ? (sliding ? 'sliding' : 'waiting') : undefined}
    >
      {/* Inline at rest so the ellipsis shows; a box while it moves. */}
      <span ref={inner}>{children}</span>
    </span>
  );
}
