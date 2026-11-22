/**
 * Generic sync orchestration. Entity-agnostic: given an EntitySyncAdapter it
 * computes a review diff (previewSync) and applies a user-approved subset of
 * changes (applySync). Per-entity source routes call these with their adapter;
 * the diff rules + apply loop stay shared.
 */

import { computeSyncDiff, type ComputeDiffOptions } from './diff';
import { isPushKind, type EntitySyncAdapter, type SyncChange, type SyncDiff } from './types';

export interface SyncSourceRef {
  id: string;
  /** When this source last synced — the delete boundary for the diff. */
  lastSynced: Date | null;
}

export interface PreviewOptions extends Omit<ComputeDiffOptions, 'lastSynced' | 'push'> {
  /**
   * Also propose sending Prism's changes back (#1206). Given only for a source
   * whose token can write and an entity whose adapter can push.
   */
  push?: { knownExternalIds: ReadonlySet<string> };
}

/** Compute the review diff for a source (never applies anything). */
export async function previewSync<TPayload>(
  adapter: EntitySyncAdapter<TPayload>,
  source: SyncSourceRef,
  options: PreviewOptions = {},
): Promise<SyncDiff<TPayload>> {
  const { push, ...diffOptions } = options;
  const pushAdapter = push ? adapter.push : undefined;
  const [remote, local, candidates] = await Promise.all([
    adapter.fetchRemote(source.id),
    adapter.loadLocal(source.id),
    pushAdapter ? pushAdapter.loadCandidates(source.id) : Promise.resolve([]),
  ]);
  return computeSyncDiff(remote, local, {
    lastSynced: source.lastSynced,
    ...diffOptions,
    push: pushAdapter && push ? { candidates, knownExternalIds: push.knownExternalIds } : undefined,
  });
}

export interface ApplyResult {
  applied: { add: number; update: number; delete: number };
  /** Changes sent back to the source (#1206). */
  sent: { add: number; update: number; delete: number };
  errors: string[];
}

/**
 * Apply a user-approved subset of changes. Each change is isolated — one
 * failure doesn't abort the rest; failures are collected and returned.
 */
export async function applySync<TPayload>(
  adapter: EntitySyncAdapter<TPayload>,
  sourceId: string,
  changes: SyncChange<TPayload>[],
): Promise<ApplyResult> {
  const applied = { add: 0, update: 0, delete: 0 };
  const sent = { add: 0, update: 0, delete: 0 };
  const errors: string[] = [];
  for (const change of changes) {
    try {
      if (isPushKind(change.kind)) {
        if (!adapter.push) throw new Error('this source does not take changes back');
        if (change.kind === 'push-add') {
          await adapter.push.pushAdd(sourceId, change);
          sent.add += 1;
        } else if (change.kind === 'push-update') {
          await adapter.push.pushUpdate(sourceId, change);
          sent.update += 1;
        } else {
          await adapter.push.pushDelete(sourceId, change);
          sent.delete += 1;
        }
      } else if (change.kind === 'add') {
        await adapter.applyAdd(sourceId, change);
        applied.add += 1;
      } else if (change.kind === 'update') {
        await adapter.applyUpdate(sourceId, change);
        applied.update += 1;
      } else {
        await adapter.applyDelete(sourceId, change);
        applied.delete += 1;
      }
    } catch (err) {
      const verb = isPushKind(change.kind) ? `send (${change.kind.slice(5)})` : change.kind;
      errors.push(
        `Failed to ${verb} "${change.label}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return { applied, sent, errors };
}
