import type { ScreensaverEffect } from './types';
import { scaledDuration } from '../screensaverPrefs';

/**
 * Opacity, and nothing else.
 *
 * Eased in and out at both ends. This used to leave on easeInExpo — a curve
 * that does almost nothing for four fifths of its duration and then drops off a
 * cliff, so a widget sat there apparently unchanged and then vanished in the
 * last moment. That reads as a dropped frame, not as a departure. The point of
 * a fade is that you can watch it happen.
 *
 * Arriving is still the shorter of the two, and slightly quicker off the mark;
 * leaving takes its time. That asymmetry is what stops a swap reading as a
 * crossfade between slides.
 */
export const fade: ScreensaverEffect = {
  id: 'fade',
  label: 'Fade',
  durationMs: { in: 2600, out: 3400 },
  css: (shown) => ({
    opacity: shown ? 1 : 0,
    // Scaled here too: this is the one effect whose timing lives in a CSS
    // transition rather than in the frame loop, so it would otherwise ignore
    // the display's speed setting entirely.
    transition: `opacity ${scaledDuration(shown ? 2600 : 3400) / 1000}s ${
      shown ? 'cubic-bezier(.33,0,.25,1)' : 'cubic-bezier(.45,.05,.55,.95)'
    }`,
  }),
};
