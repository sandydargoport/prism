/**
 * Deciding what to do when tasks disappear from a provider.
 *
 * The reconciler used to delete the local row outright. That is unrecoverable
 * and unattributable: a provider returning a short or empty list — an outage, a
 * revoked scope, the wrong list id — wiped every synced task locally with no
 * undo and nothing said.
 *
 * Calendar already holds these for review, and the recipe sync framework
 * (lib/sync/diff.ts) adds a guard for bulk loss. This module is the same policy
 * for tasks, kept separate from the route so it can be tested without a
 * provider or a database.
 */

/** Defaults mirror lib/sync/diff.ts. See MASS_DELETE_FRACTION on the value. */
export const MASS_DELETE_MAX_ITEMS = 10;

/**
 * Note for anyone comparing with lib/sync/diff.ts: its prose says 25% in two
 * places while its code uses 0.5. The code is what runs there, so 0.5 is used
 * here too rather than propagating whichever the prose meant.
 */
export const MASS_DELETE_FRACTION = 0.5;

export interface DeletionReviewInput {
  /** Synced local tasks: those carrying an external id for this source. */
  syncedCount: number;
  /** Of those, the ones the remote no longer lists. */
  missingCount: number;
  massDelete?: { maxItems?: number; maxFraction?: number };
}

export interface DeletionReviewDecision {
  /** Flag the missing tasks for review. False means take no action at all. */
  flag: boolean;
  /** True when bulk loss tripped the guard, so nothing was flagged. */
  guardTripped: boolean;
  /** How many were left untouched because the guard fired. */
  withheld: number;
}

/**
 * Decide whether missing tasks should be flagged for review or ignored.
 *
 * The guard deliberately does NOT flag on bulk loss. Flagging hundreds of
 * tasks is not harmless: it buries the real signal and invites a bulk confirm,
 * which would destroy exactly the data the review exists to protect. A
 * provider that has genuinely lost everything will still be reflected once the
 * user removes the source.
 */
export function decideDeletionReview(input: DeletionReviewInput): DeletionReviewDecision {
  const { syncedCount, missingCount } = input;
  const maxItems = input.massDelete?.maxItems ?? MASS_DELETE_MAX_ITEMS;
  const maxFraction = input.massDelete?.maxFraction ?? MASS_DELETE_FRACTION;

  if (missingCount === 0) return { flag: false, guardTripped: false, withheld: 0 };

  // A single disappearance is always ordinary — someone ticked a task off on
  // their phone. The fraction test is meaningless on tiny sets, so it needs a
  // floor; both mirror diff.ts.
  const tripsCount = missingCount > maxItems;
  const tripsFraction = syncedCount >= 4 && missingCount / syncedCount >= maxFraction;
  const guardTripped = missingCount >= 2 && (tripsCount || tripsFraction);

  return {
    flag: !guardTripped,
    guardTripped,
    withheld: guardTripped ? missingCount : 0,
  };
}
