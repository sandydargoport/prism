/**
 * A sync review held between preview and apply (#1225).
 *
 * The preview stashes the changes it showed under `sync-diff:<diffId>`. The
 * stash also names the source and the kind of sync it was made for, so an
 * apply can refuse a review prepared for another server, or a meal-plan
 * review sent to the recipe route: either would apply changes, deletes
 * included, to ids that mean something else there.
 */
import type { SyncChange } from './types';

export type SyncDiffKind = 'recipes' | 'meal-plan';

/** How long a computed diff is held for the user to review and apply. */
export const DIFF_TTL_SECONDS = 900; // 15 minutes

type StashedDiff = {
  sourceId: string;
  kind: SyncDiffKind;
  changes: SyncChange<unknown>[];
};

export function syncDiffKey(diffId: string): string {
  return `sync-diff:${diffId}`;
}

export function serializeStashedDiff(sourceId: string, kind: SyncDiffKind, changes: SyncChange<unknown>[]): string {
  const stash: StashedDiff = { sourceId, kind, changes };
  return JSON.stringify(stash);
}

export type ReadStashedDiff =
  | { ok: true; changes: SyncChange<unknown>[] }
  | { ok: false; status: number; error: string };

const EXPIRED = 'This sync preview expired. Run the sync again and review it.';

/**
 * The changes in a stash, if it was made for this source and kind. A missing
 * stash, or one in the old shape (a bare list with nothing to check it
 * against), counts as expired.
 */
export function readStashedDiff(stored: string | null, sourceId: string, kind: SyncDiffKind): ReadStashedDiff {
  if (!stored) return { ok: false, status: 409, error: EXPIRED };
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return { ok: false, status: 409, error: EXPIRED };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, status: 409, error: EXPIRED };
  }
  const stash = parsed as Partial<StashedDiff>;
  if (!Array.isArray(stash.changes) || typeof stash.sourceId !== 'string' || typeof stash.kind !== 'string') {
    return { ok: false, status: 409, error: EXPIRED };
  }
  if (stash.kind !== kind) {
    const madeFor = stash.kind === 'meal-plan' ? 'meal plans' : 'recipes';
    return { ok: false, status: 400, error: `This review was prepared for ${madeFor}, so it cannot be applied here.` };
  }
  if (stash.sourceId !== sourceId) {
    return { ok: false, status: 400, error: 'This review was prepared for another server, so it cannot be applied here.' };
  }
  return { ok: true, changes: stash.changes };
}
