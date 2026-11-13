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

/**
 * add / update / delete bring a change from the source into Prism (pull).
 * The push- kinds send a change made in Prism back to the source (#1206):
 * only for a source whose token can write, and only after review, like a pull.
 */
export type SyncChangeKind = 'add' | 'update' | 'delete' | 'push-add' | 'push-update' | 'push-delete';

export const PUSH_KINDS: readonly SyncChangeKind[] = ['push-add', 'push-update', 'push-delete'];
export const isPushKind = (k: SyncChangeKind) => PUSH_KINDS.includes(k);

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
  /**
   * Remote id (the change key). For deletes, the local row's externalId. A
   * push-add has no remote id yet, so its key is `local:<localId>`.
   */
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
  /** Changes made in Prism to send back, when the source can write. */
  pushCounts: { add: number; update: number; delete: number };
  /**
   * True when the run would have deleted an unusually large share of the
   * synced set — the deletes are withheld and must be reviewed/re-run.
   */
  massDeleteGuardTripped: boolean;
  /** How many deletes were withheld by the guard (0 when it didn't trip). */
  withheldDeletes: number;
  /**
   * The same guard for removals made in Prism: sending many at once is held
   * back, so a wiped local table cannot empty the source's plan.
   */
  pushDeleteGuardTripped: boolean;
  withheldPushDeletes: number;
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
  /** Sending Prism's changes back (#1206). Absent: the entity only pulls. */
  push?: EntityPushAdapter<TPayload>;
}

export interface EntityPushAdapter<TPayload> {
  /** Rows made in Prism that could be sent to the source as new entries. */
  loadCandidates(sourceId: string): Promise<LocalItem[]>;
  /** Create the entry in the source and link the local row to it. */
  pushAdd(sourceId: string, change: SyncChange<TPayload>): Promise<void>;
  /** Send the local row's current state to its entry in the source. */
  pushUpdate(sourceId: string, change: SyncChange<TPayload>): Promise<void>;
  /** Remove the entry from the source (the local row is already gone). */
  pushDelete(sourceId: string, change: SyncChange<TPayload>): Promise<void>;
}
