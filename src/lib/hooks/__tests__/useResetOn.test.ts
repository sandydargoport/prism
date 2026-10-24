/**
 * @jest-environment jsdom
 */
import { useState } from 'react';
import { renderHook, act } from '@testing-library/react';
import { useResetOn } from '../useResetOn';

function useForm(key: string | null, fill: string) {
  const [value, setValue] = useState('');
  useResetOn(key, () => setValue(fill));
  return { value, setValue };
}

describe('useResetOn', () => {
  it('fills on the first render, before anything is painted', () => {
    const renders: string[] = [];
    renderHook(() => {
      const f = useForm('a', 'filled');
      renders.push(f.value);
      return f;
    });
    // React re-runs the render that set state before committing it, so the
    // committed render is the filled one; nothing empty reaches the screen.
    expect(renders[renders.length - 1]).toBe('filled');
  });

  it('leaves edits alone while the key is unchanged', () => {
    const { result, rerender } = renderHook(({ k }) => useForm(k, 'filled'), { initialProps: { k: 'a' } });
    act(() => result.current.setValue('typed'));
    rerender({ k: 'a' });
    expect(result.current.value).toBe('typed');
  });

  it('refills when the key changes', () => {
    const { result, rerender } = renderHook(({ k, fill }) => useForm(k, fill), {
      initialProps: { k: 'a' as string | null, fill: 'one' },
    });
    act(() => result.current.setValue('typed'));
    rerender({ k: 'b', fill: 'two' });
    expect(result.current.value).toBe('two');
  });
});
