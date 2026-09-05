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
 * `max(2, ceil(2n/3))`, never more than there are widgets.
 *
 * Roughly two thirds, so a third of the board is in motion at any time. This
 * was `ceil(n/2) - 1`, described as "just under half" — but for the layouts
 * people actually build it was nowhere near: six widgets showed two, which is a
 * third, and reads as a mostly empty screen with a couple of things on it
 * rather than as a board with something changing.
 *
 * Two is the floor because one widget alone on a wall reads as a fault rather
 * than as a design, and a layout with one or two widgets should show them all.
 */
export function showingCount(total: number, floor = 2, ceiling = 0): number {
  if (total <= 0) return 0;
  const wanted = Math.max(floor, Math.ceil((total * 2) / 3));
  const capped = ceiling > 0 ? Math.min(wanted, ceiling) : wanted;
  // Never more than exist, and never fewer than one — a floor set above the
  // number of widgets in the layout means "show them all", not "show nothing".
  return Math.max(1, Math.min(total, capped));
}

/**
 * Swap one widget out and another in.
 *
 * Returns the same array when there is nothing to rotate — every widget is
 * already showing — so callers can skip a re-render.
 */
/**
 * Where each widget sits across the board, used to choose which one a departing
 * widget hands over to.
 *
 * Water leaving one widget and arriving in another only reads as a pour if the
 * two are apart: a drain and a fill in the same column are one above the other
 * and look like a single column doing something, not like a transfer. So the
 * arriving widget is chosen from those furthest across the board — and chosen
 * randomly among them, rather than always the very furthest, or the same two
 * widgets pair with each other every time.
 */
export type ColumnOf = (id: string) => number;

export function rotate(
  all: readonly string[],
  showing: readonly string[],
  pick: () => number = Math.random,
  floor = 2,
  ceiling = 0,
  colOf?: ColumnOf,
  /** The widget that arrived last time, avoided when there is an alternative. */
  avoid?: string,
): string[] {
  const want = showingCount(all.length, floor, ceiling);
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

  // Prefer a partner well across the board from the departing widget. Anything
  // in the far half qualifies, not just the single furthest, so the same two
  // widgets do not pair off every time; and last time's arrival is skipped when
  // there is something else to choose.
  let candidates = hidden;
  if (colOf && hidden.length > 1) {
    const from = colOf(out);
    const spread = hidden.map((id) => Math.abs(colOf(id) - from));
    const furthest = Math.max(...spread);
    if (furthest > 0) {
      const far = hidden.filter((_, i) => spread[i]! >= furthest * 0.5);
      if (far.length) candidates = far;
    }
  }
  if (avoid && candidates.length > 1) {
    const fresh = candidates.filter((id) => id !== avoid);
    if (fresh.length) candidates = fresh;
  }
  const inn = candidates[Math.floor(pick() * candidates.length)]!;
  return present.map((id) => (id === out ? inn : id));
}
