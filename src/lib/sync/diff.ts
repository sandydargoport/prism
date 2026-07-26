/**
 * The safety-critical heart of the sync framework: computeSyncDiff().
 *
 * Rules (per the agreed design — favor add over delete, last-write-wins,
 * protect against mass deletion):
 *
 *  - ADD    — remote item with no matching local row → propose add.
 *  - UPDATE — matched pair where the remote is newer (last-write-wins). When
 *             the remote exposes no updatedAt (e.g. Tandoor meal plans) but
 *             both sides carry a content fingerprint, the match is proposed
 *             only when the fingerprints differ; with neither signal it always
 *             refreshes. When the LOCAL row is newer, nothing is proposed —
 *             the local edit wins (and would be pushed back in write-back).
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

type UpdateSignal = 'timestamp' | 'fingerprint' | 'refresh';

/**
 * Decide whether a matched remote item should be proposed as an update, and by
 * which signal:
 *  - timestamp   — remote exposes updatedAt and it's newer than local.
 *  - fingerprint — remote has no updatedAt but both sides carry a content
 *                  fingerprint; propose only when they differ.
 *  - refresh     — no timestamp and no fingerprints → always refresh (the old
 *                  behavior; the remote is the source of truth).
 * Returns null when nothing should change.
 */
function updateSignal<TPayload>(
  remote: RemoteItem<TPayload>,
  local: LocalItem,
): UpdateSignal | null {
  if (remote.updatedAt !== null) {
    return remote.updatedAt.getTime() > local.updatedAt.getTime() ? 'timestamp' : null;
  }
  if (remote.fingerprint !== undefined && local.fingerprint !== undefined) {
    return remote.fingerprint !== local.fingerprint ? 'fingerprint' : null;
  }
  return 'refresh';
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
    const signal = updateSignal(r, existing);
    if (signal) {
      const reason =
        signal === 'timestamp'
          ? 'Changed in source (newer than local)'
          : signal === 'fingerprint'
            ? 'Changed in source'
            : 'Refreshed from source';
      changes.push({
        kind: 'update',
        externalId: r.externalId,
        localId: existing.localId,
        label: r.label,
        payload: r.payload,
        reason,
        remoteUpdatedAt: r.updatedAt,
        localUpdatedAt: existing.updatedAt,
        defaultChecked: true,
      });
    }
    // else: local is newer / unchanged → keep local (nothing proposed);
    // write-back handles pushing a newer local edit upstream later.
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
