/**
 * @jest-environment jsdom
 */
/**
 * The one signal that keeps the screen from going idle over the editor
 * (#1342): a dashboard in edit mode, the editor page, and the editor's frame.
 */
import { act, renderHook } from '@testing-library/react';

let mockHost: object | null = null;
jest.mock('@/lib/displays/remoteEdit', () => ({ remoteEditHost: () => mockHost }));

import { holdEditing, useEditing, useHoldEditing } from '../useEditing';

beforeEach(() => { mockHost = null; });

describe('useEditing', () => {
  it('is on while something holds it, and off once every hold lets go', () => {
    const { result } = renderHook(() => useEditing());
    expect(result.current).toBe(false);
    let a = () => {};
    let b = () => {};
    act(() => { a = holdEditing(); b = holdEditing(); });
    expect(result.current).toBe(true);
    act(() => { a(); a(); });
    expect(result.current).toBe(true);
    act(() => b());
    expect(result.current).toBe(false);
  });

  it('follows edit mode, and lets go when the editor unmounts', () => {
    const { result } = renderHook(() => useEditing());
    const editor = renderHook(({ on }) => useHoldEditing(on), { initialProps: { on: false } });
    expect(result.current).toBe(false);
    editor.rerender({ on: true });
    expect(result.current).toBe(true);
    editor.rerender({ on: false });
    expect(result.current).toBe(false);
    editor.rerender({ on: true });
    editor.unmount();
    expect(result.current).toBe(false);
  });

  it('is always on inside the editor\'s frame', () => {
    mockHost = {};
    const { result } = renderHook(() => useEditing());
    expect(result.current).toBe(true);
  });
});
