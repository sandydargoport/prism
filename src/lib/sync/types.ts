/**
 * Generic, entity-agnostic types for the review-and-approve sync framework.
 *
 * The framework never applies remote changes silently. A sync run computes a
 * DIFF (adds / updates / deletes) between a remote source and Prism's local
 * rows; the user reviews it and selects which changes to apply. The same
 * machinery is reused across entities (recipes first, then tasks, shopping,
 * meals, calendars, …) by implementing an EntitySyncAdapter — the generic
 * pieces (diff computation, the review UI, apply orchestration) stay shared.
 */

export type SyncChangeKind = 'add' | 'update' | 'delete';

/** A remote item, already normalized into the local insert shape. */
export interface RemoteItem<TPayload> {
  /** Stable id of the item in the remote system (e.g. Tandoor recipe id). */
  externalId: string;
  /** Remote last-modified time, or null if the remote doesn't expose one. */
  updatedAt: Date | null;
  /**
   * Content fingerprint of the meaningful fields, for sources that expose no
   * updatedAt (e.g. Tandoor meal plans). When both sides provide one and the
   * remote has no updatedAt, the diff compares fingerprints instead of times:
   * equal → unchanged, different → update. Optional; timestamp mode is used
   * whenever updatedAt is present.
   */
  fingerprint?: string;
  /** Human label for the review UI. */
  label: string;
  /** Normalized data to insert/update locally. */
  payload: TPayload;
}

/** A local row that was previously synced (or a local-only row). */
export interface LocalItem {
  localId: string;
  /** The remote id this row was synced from, or null for local-only rows. */
  externalId: string | null;
  /** Local last-modified time. */
  updatedAt: Date;
  /** Content fingerprint recomputed from the local row (see RemoteItem). */
  fingerprint?: string;
  label: string;
}

/** One proposed change in a diff. */
export interface SyncChange<TPayload> {
  kind: SyncChangeKind;
  /** Remote id (the change key). For deletes, the local row's externalId. */
  externalId: string;
  label: string;
  /** Present for update / delete. */
  localId?: string;
  /** Present for add / update. */
  payload?: TPayload;
  /** Short human explanation shown in the review UI. */
  reason: string;
  remoteUpdatedAt?: Date | null;
  localUpdatedAt?: Date | null;
  /** Suggested checkbox state: adds/updates pre-checked, deletes opt-in. */
  defaultChecked: boolean;
}

export interface SyncDiff<TPayload> {
  changes: SyncChange<TPayload>[];
  counts: { add: number; update: number; delete: number };
  /**
   * True when the run would have deleted an unusually large share of the
   * synced set — the deletes are withheld and must be reviewed/re-run.
   */
  massDeleteGuardTripped: boolean;
  /** How many deletes were withheld by the guard (0 when it didn't trip). */
  withheldDeletes: number;
}

/**
 * Per-entity plug-in. The framework calls fetchRemote + loadLocal to build a
 * diff, then applyAdd/applyUpdate/applyDelete for the user-approved subset.
 */
export interface EntitySyncAdapter<TPayload> {
  /** Stable entity kind, e.g. 'recipe'. Used in the review UI + routing. */
  entityType: string;
  /** Fetch + normalize all remote items for a source. */
  fetchRemote(sourceId: string): Promise<RemoteItem<TPayload>[]>;
  /** Load the local rows previously synced from this source (+ local-only). */
  loadLocal(sourceId: string): Promise<LocalItem[]>;
  applyAdd(sourceId: string, change: SyncChange<TPayload>): Promise<void>;
  applyUpdate(sourceId: string, change: SyncChange<TPayload>): Promise<void>;
  applyDelete(sourceId: string, change: SyncChange<TPayload>): Promise<void>;
}
