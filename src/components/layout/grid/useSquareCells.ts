import { useRef, useState, useEffect, useCallback } from 'react';

const SSR_FALLBACK = 60;

/**
 * Measures container width via ResizeObserver and computes square cell size.
 * Uses a callback ref so it works even when the target element is conditionally
 * rendered (e.g. switching between display and edit mode).
 * In fillHeight mode, row height is derived from viewport height instead.
 */
export function useSquareCells(
  cols: number,
  containerPadding: number,
  gap: number,
  fillHeight = false,
) {
  const [cellSize, setCellSize] = useState(SSR_FALLBACK);
  const [width, setWidth] = useState(0);
  // Effective scale between this element's own coordinate space and the
  // viewport's. A per-display font scale renders the dashboard inside a CSS
  // `zoom` wrapper, and the two spaces stop agreeing: `clientWidth` is already
  // divided by the zoom, while `window.innerHeight` is not. Anything mixing the
  // two budgets a height in root pixels and then renders it magnified, which
  // pushes the bottom of the grid off the screen. Callers divide viewport-derived
  // figures by this to get back into local units. 1 when unscaled.
  const [zoom, setZoom] = useState(1);
  // Measured distance from the top of the viewport to the top of the grid
  // container (i.e. the real header/chrome height) — more reliable than a
  // hardcoded headerOffset for fitting the design into the viewport.
  const [top, setTop] = useState(0);
  const [mounted, setMounted] = useState(false);
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);

  const compute = useCallback(() => {
    if (fillHeight) {
      setMounted(true);
      const vh = typeof window !== 'undefined' ? window.innerHeight : 720;
      setCellSize(Math.max(30, Math.floor((vh - 2 * containerPadding - (cols - 1) * gap) / cols)));
      return;
    }
    const el = nodeRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const w = el.clientWidth;
    setWidth(w);
    setTop(rect.top);
    // offsetWidth (not clientWidth) because getBoundingClientRect includes
    // borders too; the ratio is then exactly the accumulated zoom.
    const z = el.offsetWidth > 0 ? rect.width / el.offsetWidth : 1;
    setZoom(Number.isFinite(z) && z > 0 ? z : 1);
    setMounted(true);
    if (w <= 0) return;
    const available = w - 2 * containerPadding - (cols - 1) * gap;
    // Enforce minimum 16px cells so grid remains usable on narrow screens (e.g. iPad portrait)
    setCellSize(Math.max(16, Math.floor(available / cols)));
  }, [cols, containerPadding, gap, fillHeight]);

  // Callback ref — re-measures and re-attaches ResizeObserver when element changes
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    nodeRef.current = node;
    if (roRef.current) {
      roRef.current.disconnect();
      roRef.current = null;
    }
    if (node && !fillHeight) {
      compute();
      // Re-measure after layout settles: the ResizeObserver fires on the
      // container's SIZE, but its top offset (header/nav chrome above it) only
      // becomes accurate once the surrounding chrome has laid out — a position
      // change the observer never sees. rAF catches the first settled frame;
      // the delayed passes catch late layout (fonts, async header content, a
      // taller touch-device header) that would otherwise leave `top` stale and
      // the grid mis-sized (bottom-row clip on a real kiosk).
      requestAnimationFrame(compute);
      // Multiple settle passes: the header height can change after first paint
      // (web fonts, async toolbar toggles/badges, a taller touch-device header),
      // which would otherwise leave `top` stale and clip the bottom row.
      setTimeout(compute, 200);
      setTimeout(compute, 600);
      setTimeout(compute, 1200);
      setTimeout(compute, 2500);
      const ro = new ResizeObserver(compute);
      ro.observe(node);
      roRef.current = ro;
    }
  }, [compute, fillHeight]);

  // Re-measure on window resize (covers both fillHeight and fit modes — the
  // latter needs it because the container's top can shift without its size
  // changing, which the ResizeObserver wouldn't catch).
  useEffect(() => {
    const onResize = () => compute();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [compute]);

  // Cleanup ResizeObserver on unmount
  useEffect(() => {
    return () => roRef.current?.disconnect();
  }, []);

  return { containerRef, cellSize, width, top, zoom, mounted, remeasure: compute };
}
