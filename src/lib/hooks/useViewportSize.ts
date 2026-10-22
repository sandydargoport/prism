'use client';

import { useSyncExternalStore } from 'react';

export interface ViewportSize {
  width: number;
  height: number;
  /**
   * The part of `height` actually visible: smaller when some kiosk browsers
   * over-report innerHeight past a device or browser bar. Equal to `height`
   * where the browser has no visual viewport, or reports it as 0 before its
   * first layout.
   */
  visibleHeight: number;
}

function read(): ViewportSize {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const visual = window.visualViewport?.height ?? 0;
  return { width, height, visibleHeight: visual > 0 ? Math.min(height, visual) : height };
}

const SERVER_SIZE: ViewportSize = { width: 0, height: 0, visibleHeight: 0 };
let cached: ViewportSize = SERVER_SIZE;

/** The same object while nothing changed, as useSyncExternalStore requires. */
function snapshot(): ViewportSize {
  const next = read();
  if (next.width !== cached.width || next.height !== cached.height || next.visibleHeight !== cached.visibleHeight) {
    cached = next;
  }
  return cached;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('resize', onChange);
  window.addEventListener('orientationchange', onChange);
  window.visualViewport?.addEventListener('resize', onChange);
  return () => {
    window.removeEventListener('resize', onChange);
    window.removeEventListener('orientationchange', onChange);
    window.visualViewport?.removeEventListener('resize', onChange);
  };
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
 * SSR and hydration: the server has no window and renders with 0 x 0.
 * useSyncExternalStore hydrates with that same server value and then
 * re-renders with the real one. Reading the window during the first client
 * render instead (as this hook once did) made the client's first render
 * differ from the server's HTML; React does not patch a mismatched style in
 * production, and with no state change left to re-render, the server's
 * layout (a 120 px dashboard) stayed until the window was resized.
 *
 * The visual viewport is tracked here too, rather than read during a
 * consumer's render, for the same reason.
 */
export function useViewportSize(): ViewportSize {
  return useSyncExternalStore(subscribe, snapshot, () => SERVER_SIZE);
}
