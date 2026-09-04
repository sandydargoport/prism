/**
 * How many widgets the screensaver shows at once, and which.
 *
 * The screensaver has always drawn every widget in its layout, all the time,
 * which is both busy and the worst case for image retention: nothing on screen
 * ever changes position. Showing a subset and rotating it gives the board slow
 * movement without needing any notion of which widget matters more — the count
 * is fixed, the membership rotates, and nothing has to be ranked.
 */

/**
 * `max(2, ceil(n/2) - 1)`, never more than there are widgets.
 *
 * Just under half. Two is the floor because one widget alone on a wall reads as
 * a fault rather than as a design, and a layout with one or two widgets should
 * simply show them all.
 */
export function showingCount(total: number): number {
  if (total <= 0) return 0;
  return Math.min(total, Math.max(2, Math.ceil(total / 2) - 1));
}

/**
 * Swap one widget out and another in.
 *
 * Returns the same array when there is nothing to rotate — every widget is
 * already showing — so callers can skip a re-render.
 */
export function rotate(
  all: readonly string[],
  showing: readonly string[],
  pick: () => number = Math.random,
): string[] {
  const want = showingCount(all.length);
  const present = showing.filter((id) => all.includes(id));
  const hidden = all.filter((id) => !present.includes(id));

  // fill up first, if the layout grew or this is the first run
  if (present.length < want) {
    const add = hidden[Math.floor(pick() * hidden.length)] ?? hidden[0];
    return add ? [...present, add] : present;
  }
  if (present.length > want) return present.slice(0, want);
  if (!hidden.length) return present as string[];

  const out = present[Math.floor(pick() * present.length)]!;
  const inn = hidden[Math.floor(pick() * hidden.length)]!;
  return present.map((id) => (id === out ? inn : id));
}
