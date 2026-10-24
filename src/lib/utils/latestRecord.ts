/**
 * The record a panel was opened with, as the list has it now.
 *
 * A detail panel that holds the record object it was opened with goes stale
 * when the list refreshes (a favourite toggled, an edit saved). Looking it up
 * by id on every render keeps it current; the opened copy is the fallback
 * once it has left the list, so the panel does not vanish mid-action.
 */
export function latestRecord<R extends { id: string }>(list: readonly R[], opened: R): R {
  return list.find((r) => r.id === opened.id) ?? opened;
}
