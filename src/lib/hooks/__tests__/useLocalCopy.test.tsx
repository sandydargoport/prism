/**
 * @jest-environment jsdom
 */
/**
 * A local copy of a list that is edited on screen before the save lands (a
 * drag to reorder, an optimistic delete). Edits hold until the source
 * changes; then the copy starts over, and the first painted frame already
 * shows the new source rather than the old copy.
 */
import { createElement, useLayoutEffect } from 'react';
import { render, renderHook, act } from '@testing-library/react';
import { useLocalCopy, keepLocalOrder } from '../useLocalCopy';

type Item = { id: string; name: string };
const a = { id: 'a', name: 'A' };
const b = { id: 'b', name: 'B' };
const c = { id: 'c', name: 'C' };

describe('useLocalCopy', () => {
  it('holds a local edit while the source is unchanged', () => {
    const source = [a, b];
    const { result, rerender } = renderHook(({ s }) => useLocalCopy<Item[]>(s), { initialProps: { s: source } });
    act(() => result.current[1]([b, a]));
    rerender({ s: source });
    expect(result.current[0]).toEqual([b, a]);
  });

  it('starts over from a new source, in the first frame painted with it', () => {
    const painted: string[][] = [];
    function List({ items }: { items: Item[] }) {
      const [shown, setShown] = useLocalCopy(items);
      useLayoutEffect(() => { painted.push(shown.map((i) => i.id)); });
      (List as unknown as { set: typeof setShown }).set = setShown;
      return null;
    }
    const view = render(createElement(List, { items: [a, b] }));
    act(() => (List as unknown as { set: (v: Item[]) => void }).set([b, a]));
    view.rerender(createElement(List, { items: [a, b, c] }));
    // Painted: the source, the local edit, then straight to the new source.
    expect(painted).toEqual([['a', 'b'], ['b', 'a'], ['a', 'b', 'c']]);
  });

  it('updater functions build on the copy', () => {
    const source = [a, b];
    const { result } = renderHook(() => useLocalCopy<Item[]>(source));
    act(() => {
      result.current[1]((prev) => prev.filter((i) => i.id !== 'a'));
      result.current[1]((prev) => [...prev, c]);
    });
    expect(result.current[0]).toEqual([b, c]);
  });

  it('reconcile builds the new copy from the old one', () => {
    const { result, rerender } = renderHook(
      ({ s }) => useLocalCopy<Item[]>(s, keepLocalOrder),
      { initialProps: { s: [a, b] } },
    );
    act(() => result.current[1]([b, a]));
    rerender({ s: [{ ...a, name: 'A2' }, b] });
    expect(result.current[0]).toEqual([b, { id: 'a', name: 'A2' }]);
  });
});

describe('keepLocalOrder', () => {
  it('keeps the local order, updates records, drops removed ones and appends new ones', () => {
    expect(keepLocalOrder([b, a, c], [{ ...a, name: 'A2' }, b, { id: 'd', name: 'D' }])).toEqual([
      b, { id: 'a', name: 'A2' }, { id: 'd', name: 'D' },
    ]);
  });

  it('takes the fresh list as it is when there is no local order yet', () => {
    expect(keepLocalOrder([], [a, b])).toEqual([a, b]);
  });
});
