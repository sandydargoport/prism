/**
 * Generic sync orchestration. Entity-agnostic: given an EntitySyncAdapter it
 * computes a review diff (previewSync) and applies a user-approved subset of
 * changes (applySync). Per-entity source routes call these with their adapter;
 * the diff rules + apply loop stay shared.
 */

import { computeSyncDiff, type ComputeDiffOptions } from './diff';
import type { EntitySyncAdapter, SyncChange, SyncDiff } from './types';

export interface SyncSourceRef {
  id: string;
  /** When this source last synced — the delete boundary for the diff. */
  lastSynced: Date | null;
}

/** Compute the review diff for a source (never applies anything). */
export async function previewSync<TPayload>(
  adapter: EntitySyncAdapter<TPayload>,
  source: SyncSourceRef,
  diffOptions?: Omit<ComputeDiffOptions, 'lastSynced'>,
): Promise<SyncDiff<TPayload>> {
  const [remote, local] = await Promise.all([
    adapter.fetchRemote(source.id),
    adapter.loadLocal(source.id),
  ]);
  return computeSyncDiff(remote, local, { lastSynced: source.lastSynced, ...diffOptions });
}

export interface ApplyResult {
  applied: { add: number; update: number; delete: number };
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
  const errors: string[] = [];
  for (const change of changes) {
    try {
      if (change.kind === 'add') {
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
      errors.push(
        `Failed to ${change.kind} "${change.label}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return { applied, errors };
}
