import type { ScreensaverEffect } from './types';

/**
 * A waterline crossing the widget: it fills to arrive and drains to leave.
 *
 * The level is moved with mask-POSITION, not by re-declaring the gradient.
 * Chromium does not interpolate between two different linear-gradient() values,
 * so animating mask-image snaps from one to the other in a single frame — with
 * an opacity transition alongside, that looked exactly like a plain crossfade,
 * which is what this mode did for its first outing. mask-position is a length,
 * and animates properly: measured 100 distinct waterline positions per
 * transition where the old version had one.
 *
 * The gradient is drawn at twice the widget's height so that sliding it from
 * one end to the other carries the waterline across the whole widget: its lower
 * half is opaque, its upper half is clear.
 */
const MASK = 'linear-gradient(to top, #000 0%, #000 46%, transparent 56%, transparent 100%)';

export const liquid: ScreensaverEffect = {
  id: 'liquid',
  label: 'Fill and drain',
  durationMs: { in: 3400, out: 3400 },
  css: (shown) => ({
    WebkitMaskImage: MASK,
    maskImage: MASK,
    WebkitMaskSize: '100% 200%',
    maskSize: '100% 200%',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    // 0% shows the clear top half (empty); 100% the opaque bottom half (full).
    WebkitMaskPosition: shown ? '0% 100%' : '0% 0%',
    maskPosition: shown ? '0% 100%' : '0% 0%',
    transition:
      'mask-position 3.4s cubic-bezier(.45,.05,.55,.95), ' +
      '-webkit-mask-position 3.4s cubic-bezier(.45,.05,.55,.95)',
    // Opacity stays put: a fade running alongside the level hides the very
    // thing this mode exists to show.
    opacity: 1,
  }),
};
