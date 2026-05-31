'use client';

import { useEffect, useState } from 'react';

export interface ViewportSize {
  width: number;
  height: number;
}

/**
 * Track the current viewport size, updating on resize + orientation change.
 *
 * Bug pattern this exists to fix (#73): consumers that read
 * `window.innerHeight` inside a useMemo lock in whatever value the viewport
 * had at mount time. On thin clients / kiosks where the browser launches
 * before the window manager finalizes its work area, the dashboard renders
 * against an interim (smaller) viewport, then never re-measures when the
 * work area grows. Refresh "fixes" it because the second mount sees the
 * settled viewport.
 *
 * SSR: returns {0, 0} on the server; lazy init reads real values on the
 * first client render. The effect re-runs `update()` immediately on mount
 * so any race against window-resize-before-effect-attaches is still caught.
 */
export function useViewportSize(): ViewportSize {
  const [size, setSize] = useState<ViewportSize>(() => {
    if (typeof window === 'undefined') return { width: 0, height: 0 };
    return { width: window.innerWidth, height: window.innerHeight };
  });

  useEffect(() => {
    const update = () => {
      setSize((prev) => {
        const next = { width: window.innerWidth, height: window.innerHeight };
        if (prev.width === next.width && prev.height === next.height) return prev;
        return next;
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return size;
}
