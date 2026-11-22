/**
 * Tests for the generic sync runner using a mock adapter — verifies it wires
 * fetchRemote+loadLocal into the diff engine (previewSync) and dispatches an
 * approved subset by kind with per-change error isolation (applySync).
 */

import { previewSync, applySync } from '../runner';
import type { EntitySyncAdapter, LocalItem, RemoteItem, SyncChange } from '../types';

type P = { name: string };

function makeAdapter(remote: RemoteItem<P>[], local: LocalItem[]) {
  const calls = { add: [] as string[], update: [] as string[], delete: [] as string[] };
  const adapter: EntitySyncAdapter<P> = {
    entityType: 'test',
    fetchRemote: jest.fn().mockResolvedValue(remote),
    loadLocal: jest.fn().mockResolvedValue(local),
    applyAdd: jest.fn(async (_s, c: SyncChange<P>) => { calls.add.push(c.externalId); }),
    applyUpdate: jest.fn(async (_s, c: SyncChange<P>) => { calls.update.push(c.externalId); }),
    applyDelete: jest.fn(async (_s, c: SyncChange<P>) => { calls.delete.push(c.externalId); }),
  };
  return { adapter, calls };
}

const r = (id: string, name = id): RemoteItem<P> => ({ externalId: id, updatedAt: new Date('2026-07-20'), label: name, payload: { name } });
const l = (localId: string, externalId: string, name = externalId): LocalItem => ({ localId, externalId, updatedAt: new Date('2026-07-01'), label: name });

describe('previewSync', () => {
  it('computes a diff from the adapter fetch + load', async () => {
    const { adapter } = makeAdapter([r('a'), r('b')], [l('l1', 'a')]);
    const diff = await previewSync(adapter, { id: 'src', lastSynced: new Date('2026-07-10') });
    expect(adapter.fetchRemote).toHaveBeenCalledWith('src');
    expect(adapter.loadLocal).toHaveBeenCalledWith('src');
    // 'b' is new (add); 'a' remote newer than local (update)
    expect(diff.counts).toEqual({ add: 1, update: 1, delete: 0 });
  });
});

describe('applySync', () => {
  it('dispatches each change to the matching adapter method', async () => {
    const { adapter, calls } = makeAdapter([], []);
    const changes: SyncChange<P>[] = [
      { kind: 'add', externalId: 'a', label: 'a', payload: { name: 'a' }, reason: '', defaultChecked: true },
      { kind: 'update', externalId: 'b', localId: 'l2', label: 'b', payload: { name: 'b' }, reason: '', defaultChecked: true },
      { kind: 'delete', externalId: 'c', localId: 'l3', label: 'c', reason: '', defaultChecked: false },
    ];
    const res = await applySync(adapter, 'src', changes);
    expect(res.applied).toEqual({ add: 1, update: 1, delete: 1 });
    expect(calls).toEqual({ add: ['a'], update: ['b'], delete: ['c'] });
    expect(res.errors).toHaveLength(0);
  });

  it('isolates a failing change and continues the rest', async () => {
    const { adapter } = makeAdapter([], []);
    (adapter.applyUpdate as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    const changes: SyncChange<P>[] = [
      { kind: 'add', externalId: 'a', label: 'a', payload: { name: 'a' }, reason: '', defaultChecked: true },
      { kind: 'update', externalId: 'b', localId: 'l2', label: 'Broken', payload: { name: 'b' }, reason: '', defaultChecked: true },
    ];
    const res = await applySync(adapter, 'src', changes);
    expect(res.applied).toEqual({ add: 1, update: 0, delete: 0 });
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0]).toMatch(/Broken.*boom/);
  });
});

describe('sending changes back (#1206)', () => {
  function pushAdapter() {
    const { adapter } = makeAdapter([], []);
    const sent: string[] = [];
    adapter.push = {
      loadCandidates: jest.fn().mockResolvedValue([{ localId: 'n1', externalId: null, updatedAt: new Date('2026-07-20'), label: 'Pasta' }]),
      pushAdd: jest.fn(async (_s, c: SyncChange<P>) => { sent.push(`add:${c.externalId}`); }),
      pushUpdate: jest.fn(async (_s, c: SyncChange<P>) => { sent.push(`update:${c.externalId}`); }),
      pushDelete: jest.fn(async (_s, c: SyncChange<P>) => { sent.push(`delete:${c.externalId}`); }),
    };
    return { adapter, sent };
  }

  it('asks for meals to send only when pushing is on', async () => {
    const { adapter } = pushAdapter();
    const off = await previewSync(adapter, { id: 'src', lastSynced: new Date('2026-07-10') });
    expect(adapter.push!.loadCandidates).not.toHaveBeenCalled();
    expect(off.pushCounts.add).toBe(0);
    const on = await previewSync(adapter, { id: 'src', lastSynced: new Date('2026-07-10') }, { push: { knownExternalIds: new Set() } });
    expect(on.pushCounts.add).toBe(1);
  });

  it('sends each kind to the source and counts it apart from what came in', async () => {
    const { adapter, sent } = pushAdapter();
    const res = await applySync(adapter, 'src', [
      { kind: 'push-add', externalId: 'local:n1', localId: 'n1', label: 'Pasta', reason: '', defaultChecked: true },
      { kind: 'push-update', externalId: 'r2', localId: 'l2', label: 'Tacos', reason: '', defaultChecked: true },
      { kind: 'push-delete', externalId: 'r3', label: 'Soup', reason: '', defaultChecked: false },
    ]);
    expect(sent).toEqual(['add:local:n1', 'update:r2', 'delete:r3']);
    expect(res.sent).toEqual({ add: 1, update: 1, delete: 1 });
    expect(res.applied).toEqual({ add: 0, update: 0, delete: 0 });
  });

  it('reports a change to send as an error when the entity cannot send', async () => {
    const { adapter } = makeAdapter([], []);
    const res = await applySync(adapter, 'src', [
      { kind: 'push-delete', externalId: 'r3', label: 'Soup', reason: '', defaultChecked: false },
    ]);
    expect(res.errors[0]).toMatch(/Soup/);
    expect(res.sent.delete).toBe(0);
  });
});
