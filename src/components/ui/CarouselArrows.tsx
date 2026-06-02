'use client';

import { useEffect, useState, type RefObject } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CarouselArrowsProps {
  scrollRef: RefObject<HTMLElement | null>;
}

// Pointer-only affordance for horizontal carousels: touch users get the
// snap-swipe gesture; mouse users would otherwise have no obvious way to
// reveal the off-screen columns. Render only when the parent has decided
// the carousel is active AND the device isn't touch.
export function CarouselArrows({ scrollRef }: CarouselArrowsProps) {
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      setCanLeft(el.scrollLeft > 4);
      setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [scrollRef]);

  const scrollByPage = (dir: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  const btn =
    'absolute top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full ' +
    'bg-background/95 border border-border shadow-md flex items-center ' +
    'justify-center hover:bg-accent transition-opacity';

  return (
    <>
      <button
        type="button"
        onClick={() => scrollByPage(-1)}
        disabled={!canLeft}
        aria-label="Scroll left"
        className={cn(btn, 'left-1', !canLeft && 'opacity-0 pointer-events-none')}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => scrollByPage(1)}
        disabled={!canRight}
        aria-label="Scroll right"
        className={cn(btn, 'right-1', !canRight && 'opacity-0 pointer-events-none')}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </>
  );
}
