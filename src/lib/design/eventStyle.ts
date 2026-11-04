import type { CSSProperties } from 'react';

/**
 * How an event is drawn (docs/DESIGN.md "Events", #801): a pale tint of the
 * person's colour over the card colour, a solid bar of that colour on the
 * leading edge, and the text in the normal text colour. Never white text on a
 * saturated block. The tint share and bar width are the --ds-event-* tokens,
 * whose contrast for every member colour is checked in tokens.test.ts.
 *
 * `bar`: 'border' takes the place of an existing left border; 'inset' draws
 * the bar as an inset shadow, so a chip that had no border keeps its size;
 * 'none' for a slice that continues an event begun in an earlier cell.
 */
export function eventTintStyle(color: string, bar: 'border' | 'inset' | 'none' = 'inset'): CSSProperties {
  const style: CSSProperties = {
    backgroundColor: `color-mix(in srgb, ${color} var(--ds-event-tint), hsl(var(--card)))`,
    color: 'hsl(var(--card-foreground))',
  };
  if (bar === 'border') style.borderLeft = `var(--ds-event-bar) solid ${color}`;
  if (bar === 'inset') style.boxShadow = `inset var(--ds-event-bar) 0 0 0 ${color}`;
  return style;
}
