/**
 * @jest-environment jsdom
 */
import { useCallback, useState } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useFetchOnMount } from '../useFetchOnMount';

describe('useFetchOnMount', () => {
  it('loads once on mount, not again on an unrelated re-render', () => {
    const load = jest.fn(() => Promise.resolve());
    const { rerender } = renderHook(() => useFetchOnMount(load));
    rerender();
    rerender();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('loads again when the loader changes, e.g. for a different user', () => {
    const load = jest.fn((_id: string) => Promise.resolve());
    const { rerender } = renderHook(
      ({ id }) => useFetchOnMount(useCallback(() => load(id), [id])),
      { initialProps: { id: 'a' } },
    );
    rerender({ id: 'a' });
    rerender({ id: 'b' });
    expect(load.mock.calls.map((c) => c[0])).toEqual(['a', 'b']);
  });

  it('state set when the response arrives reaches the render', async () => {
    const { result } = renderHook(() => {
      const [items, setItems] = useState<string[]>([]);
      const load = useCallback(async () => {
        const data = await Promise.resolve(['milk']);
        setItems(data);
      }, []);
      useFetchOnMount(load);
      return items;
    });
    await waitFor(() => expect(result.current).toEqual(['milk']));
  });

  it('a slow earlier response does not land on top of a newer one', async () => {
    const resolvers: Record<string, (v: string) => void> = {};
    const { result, rerender } = renderHook(
      ({ q }) => {
        const [shown, setShown] = useState('');
        const load = useCallback(async (signal: AbortSignal) => {
          const data = await new Promise<string>((r) => { resolvers[q] = r; });
          if (!signal.aborted) setShown(data);
        }, [q]);
        useFetchOnMount(load);
        return shown;
      },
      { initialProps: { q: 'first' } },
    );
    rerender({ q: 'second' });
    act(() => resolvers.second!('second result'));
    await waitFor(() => expect(result.current).toBe('second result'));
    await act(async () => resolvers.first!('first result'));
    expect(result.current).toBe('second result');
  });
});
