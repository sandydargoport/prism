/**
 * Ids of the occurrences of a series Prism expands itself (#59, see
 * recurrence.ts). Kept apart from recurrence.ts so the client can read an id
 * without bundling the iCalendar parser.
 */

/** The id one occurrence of a series is served under: the row id and the occurrence's start. */
export function occurrenceId(rowId: string, start: Date): string {
  return `${rowId}_${start.getTime()}`;
}

/**
 * The row an event id addresses, and the occurrence start when the id names
 * one occurrence of a series. A plain row id has no occurrence.
 */
export function parseEventId(id: string): { rowId: string; occurrenceStart: Date | null } {
  const match = /^(.+)_(\d{1,15})$/.exec(id);
  if (!match) return { rowId: id, occurrenceStart: null };
  return { rowId: match[1]!, occurrenceStart: new Date(Number(match[2])) };
}
