/**
 * The slow zoom over each photo (#955). In from 1.03 to 1.12, or out from
 * 1.12 to 1.04, alternating photo by photo, over the photo's whole time on
 * screen, anchored on its focal point (#956).
 */
import type { PerfLevel } from '@/lib/perfLevel';
import type { FocalPoint } from './focalPoint';

export const ZOOM = {
  in: [1.03, 1.12],
  out: [1.12, 1.04],
} as const;

/** The scale at the start and end for the nth photo shown. */
export function zoomFor(n: number): readonly [number, number] {
  return n % 2 === 0 ? ZOOM.in : ZOOM.out;
}

/** Only at the full level and without reduced motion. */
export function zoomOn(level: PerfLevel, reducedMotion: boolean): boolean {
  return level === 'full' && !reducedMotion;
}

/** The CSS transform-origin for a focal point. */
export function zoomOrigin(p: FocalPoint): string {
  return `${(p.x * 100).toFixed(1)}% ${(p.y * 100).toFixed(1)}%`;
}
