/**
 * Where a dashboard list opens when it is too long for its widget (#1369,
 * #1370): at the next item, with the items that are over above it.
 *
 * Entries come in the order the list draws them, each tagged with the group
 * (day) it sits in. The next item is the first entry that is not over and is
 * allowed to be the start. It opens at:
 *
 * - its group (the day heading), when nothing over sits before it in that
 *   group, so the day's name stays in view;
 * - the item itself, when items that are over sit between the heading and it.
 *
 * When everything is over the list opens at its end, so the most recent items
 * show; an empty list has nowhere to go.
 */
export type StartEntry = {
  /** The item's anchor key. */
  key: string;
  /** The group's anchor key (its day). */
  group: string;
  /** The item is over (greyed above the start). */
  over: boolean;
  /** Whether the item may be the start. Defaults to true; all-day events, for
   *  example, are the day's backdrop and never the next thing. */
  candidate?: boolean;
};

/** The anchor that means "the end of the list". */
export const START_AT_END = '__end__';

export function startAnchor(entries: StartEntry[]): string | null {
  if (entries.length === 0) return null;
  const overInGroup = new Set<string>();
  for (const e of entries) {
    if (!e.over && e.candidate !== false) {
      return overInGroup.has(e.group) ? e.key : e.group;
    }
    if (e.over) overInGroup.add(e.group);
  }
  return START_AT_END;
}
