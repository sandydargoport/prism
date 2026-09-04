'use client';

import { useEffect, useRef } from 'react';

/**
 * A widget coming apart into its own pixels, without ever rasterising it.
 *
 * `feTurbulence` makes noise; `feColorMatrix` moves that noise into the alpha
 * channel; `feComponentTransfer` with a steep slope turns the soft noise into a
 * HARD threshold — that step is what produces discrete fragments rather than a
 * smudge — and `feComposite operator="in"` uses it to cut the widget away.
 * Sweeping the threshold erodes the element; a small displacement jitters the
 * fragments as they go.
 *
 * Everything is done by Chromium on the element's own rendered output, so the
 * fragments carry the widget's real colours, real fonts and real layout. No
 * snapshot, no canvas, no library.
 *
 * Two things are deliberate and easy to get wrong:
 *  - Driven from rAF, never SMIL. Chromium does not repaint a filter on SMIL
 *    attribute changes — measured 2 presented frames out of ~96, which looks
 *    exactly like the effect silently not working.
 *  - Erosion runs AHEAD of displacement. Displacement destroys small glyphs
 *    long before it looks intentional, so a text-heavy widget would spend the
 *    first third of the animation looking corrupted rather than dissolving.
 */
export const DISSOLVE_ID = 'prism-screensaver-dissolve';
export const DISSOLVE_MS = 1400;

export function DissolveFilter({ progress }: { progress: number }) {
  const cut = useRef<SVGFEFuncAElement>(null);
  const disp = useRef<SVGFEDisplacementMapElement>(null);

  useEffect(() => {
    const t = Math.max(0, Math.min(1, progress));
    // slope 16 with intercept sweeping 0 -> -16 moves the cut from "nothing
    // removed" to "everything removed"
    cut.current?.setAttribute('intercept', String(-16 * (0.12 + 0.92 * t)));
    // held near zero early, so the glyphs erode before they smear
    disp.current?.setAttribute('scale', String(150 * t * t));
  }, [progress]);

  return (
    <svg width="0" height="0" aria-hidden style={{ position: 'absolute' }}>
      <filter
        id={DISSOLVE_ID}
        x="-40%" y="-40%" width="180%" height="180%"
        colorInterpolationFilters="sRGB"
      >
        <feTurbulence type="fractalNoise" baseFrequency="0.11" numOctaves={2} seed={4} result="grain" />
        <feColorMatrix
          in="grain" type="matrix" result="alphaNoise"
          values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0"
        />
        <feComponentTransfer in="alphaNoise" result="cut">
          <feFuncA ref={cut} type="linear" slope="16" intercept="0" />
        </feComponentTransfer>
        <feDisplacementMap
          ref={disp} in="SourceGraphic" in2="grain" scale="0"
          xChannelSelector="R" yChannelSelector="G" result="scattered"
        />
        <feComposite in="scattered" in2="cut" operator="in" />
      </filter>
    </svg>
  );
}
