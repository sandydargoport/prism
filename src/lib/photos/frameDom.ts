'use client';

/**
 * The parts of the screen the widgets cover, measured from the page, for
 * framing a photo's subject clear of them (#957).
 */
import type { Rect } from './frame';

const COVERING = '.widget-cell, [data-today-corner], [data-today-quiet], [data-today-coming-wrap], [data-today-arc], [data-dock]';
/** A container this big is a backdrop, not a widget: it would block every crop. */
const MAX_SHARE = 0.6;

export function coveredRects(root: ParentNode = document): Rect[] {
  if (typeof window === 'undefined') return [];
  const screen = window.innerWidth * window.innerHeight;
  return [...root.querySelectorAll(COVERING)]
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0 && (r.width * r.height) / screen < MAX_SHARE)
    .map((r) => ({ left: r.left, top: r.top, width: r.width, height: r.height }));
}
