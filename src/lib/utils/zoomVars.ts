import type { CSSProperties } from 'react';

/**
 * The text floor (#798) is `max(--text-floor * --zoom-inv, size)`, so every
 * element that applies `zoom` also sets `--zoom-inv` to 1 / the zoom in force
 * there, and text it contains comes back up to the floor after the zoom.
 *
 * A page-level wrapper (layout font scale) also records its own inverse as
 * `--page-zoom-inv`, so a widget's zoom nested inside it can multiply the two:
 * a custom property cannot refer to its own inherited value.
 */
export function pageZoomVars(totalPercent: number): CSSProperties {
  const inv = String(100 / totalPercent);
  return { '--page-zoom-inv': inv, '--zoom-inv': inv } as CSSProperties;
}

/** For a widget's content zoom, nested inside any page-level zoom. */
export function widgetZoomVars(textScale: number): CSSProperties {
  return { '--zoom-inv': `calc(var(--page-zoom-inv, 1) / ${textScale})` } as CSSProperties;
}
