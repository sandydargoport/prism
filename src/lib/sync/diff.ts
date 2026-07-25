/**
 * The safety-critical heart of the sync framework: computeSyncDiff().
 *
 * Rules (per the agreed design — favor add over delete, last-write-wins,
 * protect against mass deletion):
 *
 *  - ADD    — remote item with no matching local row → propose add.
 *  - UPDATE — matched pair where the remote is newer (last-write-wins). When
 *             the remote exposes no updatedAt (e.g. Tandoor meal plans), the
 *             match is always proposed as a refresh. When the LOCAL row is
 *             newer, nothing is proposed — the local edit wins (and would be
 *             pushed back in the write-back phase).
 *  - DELETE — a previously-synced local row (has externalId) that is now
 *             absent from the remote. But it is WITHHELD when the local row
 *             was edited since the last sync (updatedAt > lastSynced): a local
 *             edit newer than the (post-lastSynced) remote delete wins, so the
 *             row is kept. Local-only rows (no externalId) are never deleted.
 *  - MASS-DELETE GUARD — if a single run would delete more than a threshold of
 *             the synced set, ALL deletes are withheld and flagged, protecting
 *             against a remote error / empty response wiping the library.
 *
 * Deletes are never applied automatically regardless — the review UI leaves
 * them unchecked. The guard is a second belt to keep them out of the diff
 * entirely when they look catastrophic.
 */

import type { RemoteItem, LocalItem, SyncChange, SyncDiff } from './types';

export interface ComputeDiffOptions {
  /** When the source last synced — the boundary for "edited since last sync". */
  lastSynced: Date | null;
  /** Mass-delete guard thresholds (whichever trips first). */
  massDelete?: {
    /** Absolute max deletes before withholding. Default 10. */
    maxItems?: number;
    /** Max fraction of the synced set before withholding. Default 0.25. */
    maxFraction?: number;
  };
}

function remoteIsNewer(remote: Date | null, local: Date): boolean {
  // Remote exposes no timestamp → treat as a refresh candidate.
  if (remote === null) return true;
  return remote.getTime() > local.getTime();
}

export function computeSyncDiff<TPayload>(
  remote: RemoteItem<TPayload>[],
  local: LocalItem[],
  opts: ComputeDiffOptions,
): SyncDiff<TPayload> {
  const remoteIds = new Set(remote.map((r) => r.externalId));
  const localSynced = local.filter((l) => l.externalId !== null);
  const localByExternal = new Map(localSynced.map((l) => [l.externalId as string, l]));

  const changes: SyncChange<TPayload>[] = [];

  // Adds + updates.
  for (const r of remote) {
    const existing = localByExternal.get(r.externalId);
    if (!existing) {
      changes.push({
        kind: 'add',
        externalId: r.externalId,
        label: r.label,
        payload: r.payload,
        reason: 'New in source',
        remoteUpdatedAt: r.updatedAt,
        defaultChecked: true,
      });
      continue;
    }
    if (remoteIsNewer(r.updatedAt, existing.updatedAt)) {
      changes.push({
        kind: 'update',
        externalId: r.externalId,
        localId: existing.localId,
        label: r.label,
        payload: r.payload,
        reason: r.updatedAt === null ? 'Changed in source' : 'Changed in source (newer than local)',
        remoteUpdatedAt: r.updatedAt,
        localUpdatedAt: existing.updatedAt,
        defaultChecked: true,
      });
    }
    // else: local is newer → keep local (nothing proposed); write-back handles it.
  }

  // Delete candidates: previously synced, now absent from the remote.
  const deleteCandidates: SyncChange<TPayload>[] = [];
  for (const l of localSynced) {
    if (remoteIds.has(l.externalId as string)) continue;
    const editedSinceSync = opts.lastSynced ? l.updatedAt.getTime() > opts.lastSynced.getTime() : false;
    if (editedSinceSync) continue; // local edit newer than the delete → keep it
    deleteCandidates.push({
      kind: 'delete',
      externalId: l.externalId as string,
      localId: l.localId,
      label: l.label,
      reason: 'Removed from source',
      localUpdatedAt: l.updatedAt,
      defaultChecked: false, // opt-in: never pre-checked
    });
  }

  // Mass-delete guard. Only fires for *bulk* loss — a single (or a couple of)
  // deletes are always allowed through; the fraction check ignores tiny sets
  // where a fraction is meaningless.
  const maxItems = opts.massDelete?.maxItems ?? 10;
  const maxFraction = opts.massDelete?.maxFraction ?? 0.5;
  const syncedCount = localSynced.length;
  const wouldDelete = deleteCandidates.length;
  const tripsCount = wouldDelete > maxItems;
  const tripsFraction = syncedCount >= 4 && wouldDelete / syncedCount >= maxFraction;
  const massDeleteGuardTripped = wouldDelete >= 2 && (tripsCount || tripsFraction);

  let withheldDeletes = 0;
  if (massDeleteGuardTripped) {
    withheldDeletes = deleteCandidates.length;
  } else {
    changes.push(...deleteCandidates);
  }

  return {
    changes,
    counts: {
      add: changes.filter((c) => c.kind === 'add').length,
      update: changes.filter((c) => c.kind === 'update').length,
      delete: changes.filter((c) => c.kind === 'delete').length,
    },
    massDeleteGuardTripped,
    withheldDeletes,
  };
}
