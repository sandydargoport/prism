/**
 * @jest-environment jsdom
 */
import { act, render } from '@testing-library/react';
import { pageAddStore, usePageAdd } from '../usePageAdd';

function Page({ label, run }: { label: string; run: () => void }) {
  usePageAdd(label, run);
  return null;
}

describe('usePageAdd (#1028)', () => {
  it('registers the page Add while mounted and clears it on leaving', () => {
    const run = jest.fn();
    const { unmount } = render(<Page label="Add chore" run={run} />);
    expect(pageAddStore.get()?.label).toBe('Add chore');
    act(() => pageAddStore.get()!.run());
    expect(run).toHaveBeenCalledTimes(1);
    unmount();
    expect(pageAddStore.get()).toBeNull();
  });

  it('runs the latest handler without re-registering', () => {
    const first = jest.fn(), second = jest.fn();
    const { rerender, unmount } = render(<Page label="Add item" run={first} />);
    const entry = pageAddStore.get();
    rerender(<Page label="Add item" run={second} />);
    expect(pageAddStore.get()).toBe(entry);
    act(() => pageAddStore.get()!.run());
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
    unmount();
  });
});
