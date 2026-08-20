/**
 * Tests for the tombstone value coercion — the bit that must never regress,
 * since a broken read would let deleted calendars silently reappear.
 */
import { normalizeTombstones } from '../settingsTombstone';

describe('normalizeTombstones', () => {
  it('reads legacy string[] as { id, name: id }', () => {
    expect(normalizeTombstones(['cal-a@group', 'cal-b@group'])).toEqual([
      { id: 'cal-a@group', name: 'cal-a@group' },
      { id: 'cal-b@group', name: 'cal-b@group' },
    ]);
  });

  it('passes through { id, name } entries', () => {
    expect(normalizeTombstones([{ id: 'x', name: 'Cadet Orchestra' }])).toEqual([
      { id: 'x', name: 'Cadet Orchestra' },
    ]);
  });

  it('backfills a missing/empty name with the id', () => {
    expect(normalizeTombstones([{ id: 'x' }, { id: 'y', name: '' }])).toEqual([
      { id: 'x', name: 'x' },
      { id: 'y', name: 'y' },
    ]);
  });

  it('drops malformed entries and non-arrays', () => {
    expect(normalizeTombstones([{ name: 'no id' }, 42, null])).toEqual([]);
    expect(normalizeTombstones(undefined)).toEqual([]);
    expect(normalizeTombstones('not-an-array')).toEqual([]);
  });
});
