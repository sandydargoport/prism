'use client';

import { useCallback, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

/**
 * A local, editable copy of a value that comes from props or a data hook.
 *
 * For lists that are changed on screen before the server has the change (a
 * drag to reorder, an optimistic toggle or delete): edits go to the copy, and
 * the copy starts over from the source whenever the source changes, as when a
 * refresh hands back the saved list.
 *
 * Copying in an effect did the same with an extra render: the new source was
 * painted with the old copy first, then corrected. Here the copy starts over
 * in the render that first sees the new source.
 *
 * `source` is compared by identity, so it must keep its identity while it is
 * unchanged (state, or a useMemo); a fresh array on every render would start
 * the copy over on every render. `reconcile` builds the new copy from the old
 * one and the new source, for a copy that keeps something of its own (a local
 * order, say) across refreshes.
 */
export function useLocalCopy<T>(
  source: T,
  reconcile?: (local: T, source: T) => T,
): [T, Dispatch<SetStateAction<T>>] {
  const [copy, setCopy] = useState({ source, value: source });
  let current = copy;
  if (!Object.is(copy.source, source)) {
    current = { source, value: reconcile ? reconcile(copy.value, source) : source };
    setCopy(current);
  }

  const setValue = useCallback<Dispatch<SetStateAction<T>>>((next) => {
    setCopy((c) => ({
      source: c.source,
      value: typeof next === 'function' ? (next as (prev: T) => T)(c.value) : next,
    }));
  }, []);

  return [current.value, setValue];
}

/**
 * A `reconcile` for lists of records with ids: the refreshed records in the
 * order already on screen. Known records keep their place with the new data,
 * removed ones drop out, and new ones are added at the end.
 */
export function keepLocalOrder<R extends { id: string }>(local: R[], fresh: R[]): R[] {
  if (local.length === 0) return fresh;
  const byId = new Map(fresh.map((r) => [r.id, r]));
  const kept = local.flatMap((r) => {
    const updated = byId.get(r.id);
    return updated ? [updated] : [];
  });
  const known = new Set(local.map((r) => r.id));
  return [...kept, ...fresh.filter((r) => !known.has(r.id))];
}
