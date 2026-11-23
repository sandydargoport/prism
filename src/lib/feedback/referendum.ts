/**
 * The question the Feedback card asks (#1311): one at a time, one answer per
 * install. A later question changes only the data in REFERENDUM; the card,
 * the route and the collector stay as they are.
 *
 * Client-safe: no server imports, so the card and the route read the same
 * definition.
 */

export type ReferendumAnswer = {
  /** Stable slug sent to the counter. Never reuse one for a different meaning. */
  id: string;
  /** What the button says. */
  label: string;
};

export type Referendum = {
  /** Stable slug sent to the counter, e.g. "2026-11-navigation". */
  id: string;
  question: string;
  /** Two or more. */
  answers: readonly ReferendumAnswer[];
  /** ISO date or timestamp after which the card hides and votes are refused. Unset: open. */
  openUntil?: string;
  /**
   * A public poll for installs that send nothing (anonymous stats off). Empty:
   * the card shows no link.
   */
  pollUrl: string;
};

export const REFERENDUM: Referendum = {
  id: '2026-11-navigation',
  question: 'Navigation moved from the sidebar to the bar along the bottom. Which do you prefer?',
  answers: [
    { id: 'bottom-bar', label: 'Keep the bottom bar' },
    { id: 'sidebar', label: 'Bring back the sidebar' },
  ],
  // Set when the GitHub poll exists.
  pollUrl: '',
};

/** Whether the question still takes answers. A date with no time runs to the end of that day (UTC). */
export function isReferendumOpen(r: Referendum = REFERENDUM, now: Date = new Date()): boolean {
  if (!r.openUntil) return true;
  const until = /^\d{4}-\d{2}-\d{2}$/.test(r.openUntil)
    ? Date.parse(`${r.openUntil}T23:59:59.999Z`)
    : Date.parse(r.openUntil);
  if (Number.isNaN(until)) return true;
  return now.getTime() <= until;
}

/** The answer with this id, if the question has one. */
export function findAnswer(r: Referendum, answerId: unknown): ReferendumAnswer | undefined {
  if (typeof answerId !== 'string') return undefined;
  return r.answers.find((a) => a.id === answerId);
}
