import type { ScreensaverEffect } from './types';

/**
 * Opacity, and nothing else.
 *
 * Arriving and leaving are deliberately not mirror images: a widget appears at
 * once and then settles (easeOutExpo), and it holds a moment and then goes
 * quickly (easeInExpo). Symmetric easing reads as a crossfade between slides,
 * which is precisely what this should not feel like.
 */
export const fade: ScreensaverEffect = {
  id: 'fade',
  label: 'Fade',
  durationMs: { in: 2400, out: 3200 },
  css: (shown) => ({
    opacity: shown ? 1 : 0,
    transition: `opacity ${shown ? 2.4 : 3.2}s ${
      shown ? 'cubic-bezier(.16,1,.3,1)' : 'cubic-bezier(.7,0,.84,0)'
    }`,
  }),
};
