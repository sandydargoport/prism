/**
 * Tests for the sync diff engine — the safety-critical core. Every rule from
 * the agreed design gets an explicit case: favor-add, last-write-wins (incl.
 * remote-has-no-timestamp), delete-only-when-absent-and-not-locally-edited,
 * protect local-only rows, and the mass-delete guard.
 */

import { computeSyncDiff, type ComputeDiffOptions } from '../diff';
import type { RemoteItem, LocalItem } from '../types';

type P = { name: string };

function remote(externalId: string, updatedAt: Date | null, name = externalId, fingerprint?: string): RemoteItem<P> {
  return { externalId, updatedAt, fingerprint, label: name, payload: { name } };
}
function local(localId: string, externalId: string | null, updatedAt: Date, name = externalId ?? localId, fingerprint?: string): LocalItem {
  return { localId, externalId, updatedAt, fingerprint, label: name };
}

const T0 = new Date('2026-07-01T00:00:00Z'); // old
const T1 = new Date('2026-07-10T00:00:00Z'); // lastSynced
const T2 = new Date('2026-07-20T00:00:00Z'); // newer
const OPTS = (lastSynced: Date | null = T1): ComputeDiffOptions => ({ lastSynced });

describe('computeSyncDiff — adds', () => {
  it('proposes an add for a remote item with no local match', () => {
    const d = computeSyncDiff([remote('r1', T2)], [], OPTS());
    expect(d.counts).toEqual({ add: 1, update: 0, delete: 0 });
    expect(d.changes[0]).toMatchObject({ kind: 'add', externalId: 'r1', defaultChecked: true });
  });
});

describe('computeSyncDiff — updates (last-write-wins)', () => {
  it('proposes an update when the remote is newer than local', () => {
    const d = computeSyncDiff([remote('r1', T2)], [local('l1', 'r1', T0)], OPTS());
    expect(d.counts.update).toBe(1);
    expect(d.changes[0]).toMatchObject({ kind: 'update', localId: 'l1', defaultChecked: true });
  });

  it('proposes NO change when the local row is newer than the remote', () => {
    const d = computeSyncDiff([remote('r1', T0)], [local('l1', 'r1', T2)], OPTS());
    expect(d.changes).toHaveLength(0);
  });

  it('treats a remote with no timestamp AND no fingerprint as a refresh (always proposes update)', () => {
    const d = computeSyncDiff([remote('r1', null)], [local('l1', 'r1', T2)], OPTS());
    expect(d.counts.update).toBe(1);
    expect(d.changes[0]!.reason).toMatch(/refreshed from source/i);
  });

  it('no timestamp but matching fingerprints → NO change (unchanged meal-plan entry)', () => {
    const d = computeSyncDiff(
      [remote('r1', null, 'r1', 'fp-A')],
      [local('l1', 'r1', T2, 'r1', 'fp-A')],
      OPTS(),
    );
    expect(d.changes).toHaveLength(0);
  });

  it('no timestamp but differing fingerprints → update (edited meal-plan entry)', () => {
    const d = computeSyncDiff(
      [remote('r1', null, 'r1', 'fp-B')],
      [local('l1', 'r1', T2, 'r1', 'fp-A')],
      OPTS(),
    );
    expect(d.counts.update).toBe(1);
    expect(d.changes[0]!.reason).toMatch(/changed in source/i);
  });
});

describe('computeSyncDiff — deletes', () => {
  it('proposes a delete for a synced row now absent from the remote (not edited since sync)', () => {
    // local edited at T0, lastSynced T1 → not edited since sync → delete candidate
    const d = computeSyncDiff([], [local('l1', 'r1', T0)], OPTS(T1));
    expect(d.counts.delete).toBe(1);
    expect(d.changes[0]).toMatchObject({ kind: 'delete', localId: 'l1', defaultChecked: false });
  });

  it('WITHHOLDS the delete when the local row was edited since the last sync', () => {
    // local edited at T2 (after lastSynced T1) → local edit newer than delete → keep
    const d = computeSyncDiff([], [local('l1', 'r1', T2)], OPTS(T1));
    expect(d.counts.delete).toBe(0);
    expect(d.changes).toHaveLength(0);
  });

  it('never deletes a local-only row (no externalId)', () => {
    const d = computeSyncDiff([], [local('l1', null, T0)], OPTS(T1));
    expect(d.changes).toHaveLength(0);
  });

  it('deletes are opt-in (defaultChecked=false)', () => {
    const d = computeSyncDiff([], [local('l1', 'r1', T0)], OPTS(T1));
    expect(d.changes[0]!.defaultChecked).toBe(false);
  });
});

describe('computeSyncDiff — mass-delete guard', () => {
  const synced = (n: number) =>
    Array.from({ length: n }, (_, i) => local(`l${i}`, `r${i}`, T0));

  it('withholds ALL deletes when more than maxItems would be deleted', () => {
    // 12 synced rows, remote empty → 12 deletes > default maxItems (10) → withheld
    const d = computeSyncDiff([], synced(12), { lastSynced: T1, massDelete: { maxFraction: 1 } });
    expect(d.massDeleteGuardTripped).toBe(true);
    expect(d.withheldDeletes).toBe(12);
    expect(d.counts.delete).toBe(0);
  });

  it('withholds deletes when the remote drops a large fraction of the synced set', () => {
    // 6 synced, remote returns none → 100% would be deleted (under maxItems=10,
    // so this isolates the fraction path) → withheld.
    const d = computeSyncDiff([], synced(6), { lastSynced: T1 });
    expect(d.massDeleteGuardTripped).toBe(true);
    expect(d.counts.delete).toBe(0);
    expect(d.withheldDeletes).toBe(6);
  });

  it('does NOT trip for a small number of deletes within thresholds', () => {
    // 10 synced, 1 absent → 1 delete, 10% → under both thresholds
    const localRows = [...synced(9), local('x1', 'gone', T0)];
    const remoteRows = Array.from({ length: 9 }, (_, i) => remote(`r${i}`, T0));
    const d = computeSyncDiff(remoteRows, localRows, { lastSynced: T1 });
    expect(d.massDeleteGuardTripped).toBe(false);
    expect(d.counts.delete).toBe(1);
  });

  it('adds/updates are unaffected when the delete guard trips', () => {
    const localRows = synced(12);
    const d = computeSyncDiff([remote('new1', T2)], localRows, { lastSynced: T1, massDelete: { maxFraction: 1 } });
    expect(d.massDeleteGuardTripped).toBe(true);
    expect(d.counts.add).toBe(1);
    expect(d.counts.delete).toBe(0);
  });
});

describe('computeSyncDiff — combined', () => {
  it('produces adds, updates, and deletes together', () => {
    const remoteRows = [remote('keep', T0), remote('changed', T2), remote('new', T2)];
    const localRows = [
      local('l-keep', 'keep', T0), // unchanged
      local('l-changed', 'changed', T0), // remote newer → update
      local('l-gone', 'gone', T0), // absent → delete
      local('l-local', null, T0), // local-only → untouched
    ];
    const d = computeSyncDiff(remoteRows, localRows, OPTS(T1));
    expect(d.counts).toEqual({ add: 1, update: 1, delete: 1 });
  });
});

describe('computeSyncDiff — sending Prism changes back (#1206)', () => {
  const PUSH = (known: string[] = [], candidates: LocalItem[] = []): ComputeDiffOptions => ({
    lastSynced: T1,
    push: { candidates, knownExternalIds: new Set(known) },
  });

  it('sends a meal moved in Prism since the last sync instead of pulling the old one back', () => {
    // No timestamps (meal plans): the two differ by fingerprint, Prism's row is newer than the sync.
    const d = computeSyncDiff([remote('r1', null, 'Tacos', 'tue')], [local('l1', 'r1', T2, 'Tacos', 'wed')], PUSH());
    expect(d.changes).toEqual([expect.objectContaining({ kind: 'push-update', externalId: 'r1', localId: 'l1', defaultChecked: true })]);
    expect(d.pushCounts).toEqual({ add: 0, update: 1, delete: 0 });
    expect(d.counts.update).toBe(0);
  });

  it('still pulls a change made in the source when Prism has not touched the meal', () => {
    const d = computeSyncDiff([remote('r1', null, 'Tacos', 'tue')], [local('l1', 'r1', T0, 'Tacos', 'wed')], PUSH());
    expect(d.changes[0]).toMatchObject({ kind: 'update' });
  });

  it('without a token that writes, a Prism edit is pulled over as before', () => {
    const d = computeSyncDiff([remote('r1', null, 'Tacos', 'tue')], [local('l1', 'r1', T2, 'Tacos', 'wed')], OPTS());
    expect(d.changes[0]).toMatchObject({ kind: 'update' });
    expect(d.pushCounts).toEqual({ add: 0, update: 0, delete: 0 });
  });

  it('a source that keeps timestamps and is newer still wins over a Prism edit', () => {
    const later = new Date('2026-07-25T00:00:00Z');
    const d = computeSyncDiff([remote('r1', later)], [local('l1', 'r1', T2)], PUSH());
    expect(d.changes[0]).toMatchObject({ kind: 'update' });
  });

  it('sends a removal for an entry Prism had at the last sync and no longer has, unticked', () => {
    const d = computeSyncDiff([remote('r1', null, 'Soup')], [], PUSH(['r1']));
    expect(d.changes).toEqual([expect.objectContaining({ kind: 'push-delete', externalId: 'r1', defaultChecked: false })]);
  });

  it('pulls an entry Prism never had as new, even with a token that writes', () => {
    const d = computeSyncDiff([remote('r1', null, 'Soup')], [], PUSH([]));
    expect(d.changes[0]).toMatchObject({ kind: 'add' });
  });

  it('offers meals made in Prism as new entries, pre-ticked only when made since the last sync', () => {
    const d = computeSyncDiff([], [], PUSH([], [local('n1', null, T2, 'Pasta'), local('n2', null, T0, 'Curry')]));
    expect(d.changes).toEqual([
      expect.objectContaining({ kind: 'push-add', externalId: 'local:n1', localId: 'n1', defaultChecked: true }),
      expect.objectContaining({ kind: 'push-add', externalId: 'local:n2', localId: 'n2', defaultChecked: false }),
    ]);
  });

  it('on a first sync nothing to send is pre-ticked', () => {
    const d = computeSyncDiff([], [], { lastSynced: null, push: { candidates: [local('n1', null, T2)], knownExternalIds: new Set() } });
    expect(d.changes[0]).toMatchObject({ kind: 'push-add', defaultChecked: false });
  });

  it('holds back many removals made in Prism at once', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `r${i}`);
    const d = computeSyncDiff(ids.map((id) => remote(id, null)), [], PUSH(ids));
    expect(d.pushDeleteGuardTripped).toBe(true);
    expect(d.withheldPushDeletes).toBe(12);
    expect(d.changes.filter((c) => c.kind === 'push-delete')).toEqual([]);
  });
});
