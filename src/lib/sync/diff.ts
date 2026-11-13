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
 *
 * PUSH (#1206), only when `opts.push` is given (the source's token can write):
 *  - PUSH-UPDATE — a matched pair that differs, where the local row was edited
 *             since the last sync and the source is not newer: Prism's edit
 *             goes to the source instead of being overwritten by it.
 *  - PUSH-DELETE — a source entry that was in Prism at the last sync and has
 *             no local row now: it was removed in Prism. Opt-in, like every
 *             delete, and behind the same mass guard. Without push it is
 *             pulled back in as an add, as before.
 *  - PUSH-ADD — a row made in Prism that the source has never had (the
 *             adapter says which rows qualify). Pre-checked only when made or
 *             changed since the last sync.
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
  /** Send Prism's changes back too. Omitted: pull only. */
  push?: {
    /** Local rows the source has never had, offered as new entries. */
    candidates: LocalItem[];
    /** Source ids that had a local row at the last sync. */
    knownExternalIds: ReadonlySet<string>;
  };
}

type UpdateSignal = 'fingerprint' | 'refresh';

/**
 * For a source without timestamps: whether a matched item differs.
 *  - fingerprint — both sides carry a content fingerprint; differ → update.
 *  - refresh     — no fingerprints → always refresh (the remote is the
 *                  source of truth).
 * Returns null when nothing should change.
 */
function updateSignal<TPayload>(
  remote: RemoteItem<TPayload>,
  local: LocalItem,
): UpdateSignal | null {
  if (remote.fingerprint !== undefined && local.fingerprint !== undefined) {
    return remote.fingerprint !== local.fingerprint ? 'fingerprint' : null;
  }
  return 'refresh';
}

/**
 * For a remote item matched to a local row: pull the source's version, send
 * Prism's, or leave both.
 *
 * With timestamps (#1207), "the source changed" means its time is past the
 * one Prism last saw from it (remoteSeenAt), so Prism's own push does not come
 * back as a change made there. "Prism changed" means edited since the last
 * sync. When both changed, the newer one wins and the reason says which.
 * Without remoteSeenAt the source's time is compared with the local row's, as
 * before.
 *
 * Without timestamps (meal plans, #1206): the two differ by fingerprint; a
 * Prism edit since the last sync is sent, anything else is pulled.
 */
function decideMatched<TPayload>(
  r: RemoteItem<TPayload>,
  local: LocalItem,
  localChanged: boolean,
  push: boolean,
): { kind: 'update' | 'push-update'; reason: string } | null {
  if (r.updatedAt !== null) {
    const seen = local.remoteSeenAt ?? local.updatedAt;
    const remoteChanged = r.updatedAt.getTime() > seen.getTime();
    if (remoteChanged && localChanged) {
      if (r.updatedAt.getTime() > local.updatedAt.getTime()) {
        return { kind: 'update', reason: 'Changed in both places; the other app’s is newer' };
      }
      return push ? { kind: 'push-update', reason: 'Changed in both places; Prism’s is newer' } : null;
    }
    if (remoteChanged) return { kind: 'update', reason: 'Changed in source (newer than local)' };
    if (localChanged && push) return { kind: 'push-update', reason: 'Changed in Prism' };
    return null;
  }
  const signal = updateSignal(r, local);
  if (!signal) return null;
  if (push && localChanged) return { kind: 'push-update', reason: 'Changed in Prism' };
  return { kind: 'update', reason: signal === 'fingerprint' ? 'Changed in source' : 'Refreshed from source' };
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
  const pushDeleteCandidates: SyncChange<TPayload>[] = [];
  const editedSinceSync = (l: LocalItem) =>
    opts.lastSynced ? l.updatedAt.getTime() > opts.lastSynced.getTime() : false;

  // Adds + updates.
  for (const r of remote) {
    const existing = localByExternal.get(r.externalId);
    if (!existing && opts.push?.knownExternalIds.has(r.externalId)) {
      // In Prism at the last sync, gone now: removed in Prism.
      pushDeleteCandidates.push({
        kind: 'push-delete',
        externalId: r.externalId,
        label: r.label,
        reason: 'Removed in Prism',
        remoteUpdatedAt: r.updatedAt,
        defaultChecked: false,
      });
      continue;
    }
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
    const decision = decideMatched(r, existing, editedSinceSync(existing), Boolean(opts.push));
    if (decision?.kind === 'push-update') {
      changes.push({
        kind: 'push-update',
        externalId: r.externalId,
        localId: existing.localId,
        label: existing.label,
        // The source's version, so the review can say what sending will change.
        payload: r.payload,
        reason: decision.reason,
        remoteUpdatedAt: r.updatedAt,
        localUpdatedAt: existing.updatedAt,
        defaultChecked: true,
      });
    } else if (decision?.kind === 'update') {
      changes.push({
        kind: 'update',
        externalId: r.externalId,
        localId: existing.localId,
        label: r.label,
        payload: r.payload,
        reason: decision.reason,
        remoteUpdatedAt: r.updatedAt,
        localUpdatedAt: existing.updatedAt,
        defaultChecked: true,
      });
    }
    // else: unchanged, or only Prism changed and the source only reads →
    // keep the local row as it is.
  }

  // Delete candidates: previously synced, now absent from the remote.
  const deleteCandidates: SyncChange<TPayload>[] = [];
  for (const l of localSynced) {
    if (remoteIds.has(l.externalId as string)) continue;
    if (editedSinceSync(l)) continue; // local edit newer than the delete → keep it
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
  const massDeleteGuardTripped = tripsGuard(deleteCandidates.length, localSynced.length, maxItems, maxFraction);

  let withheldDeletes = 0;
  if (massDeleteGuardTripped) {
    withheldDeletes = deleteCandidates.length;
  } else {
    changes.push(...deleteCandidates);
  }

  // The same guard for removals made in Prism, measured against what the
  // source and Prism shared at the last sync.
  const pushDeleteGuardTripped = tripsGuard(
    pushDeleteCandidates.length,
    opts.push?.knownExternalIds.size ?? 0,
    maxItems,
    maxFraction,
  );
  let withheldPushDeletes = 0;
  if (pushDeleteGuardTripped) {
    withheldPushDeletes = pushDeleteCandidates.length;
  } else {
    changes.push(...pushDeleteCandidates);
  }

  // Pre-ticked only when made or changed since the last sync. Older rows (and
  // every row on a first sync) start unticked, so connecting a token that can
  // write never sends a whole plan with one tap.
  for (const c of opts.push?.candidates ?? []) {
    changes.push({
      kind: 'push-add',
      externalId: `local:${c.localId}`,
      localId: c.localId,
      label: c.label,
      reason: 'New in Prism',
      localUpdatedAt: c.updatedAt,
      defaultChecked: editedSinceSync(c),
    });
  }

  const count = (kind: SyncChange<TPayload>['kind']) => changes.filter((c) => c.kind === kind).length;
  return {
    changes,
    counts: { add: count('add'), update: count('update'), delete: count('delete') },
    pushCounts: { add: count('push-add'), update: count('push-update'), delete: count('push-delete') },
    massDeleteGuardTripped,
    withheldDeletes,
    pushDeleteGuardTripped,
    withheldPushDeletes,
  };
}

/** Bulk loss only: one or two deletes always pass; tiny sets skip the fraction. */
function tripsGuard(wouldDelete: number, setSize: number, maxItems: number, maxFraction: number): boolean {
  const tripsCount = wouldDelete > maxItems;
  const tripsFraction = setSize >= 4 && wouldDelete / setSize >= maxFraction;
  return wouldDelete >= 2 && (tripsCount || tripsFraction);
}
