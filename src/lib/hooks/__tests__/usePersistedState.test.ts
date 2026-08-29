/**
 * @jest-environment jsdom
 */
/**
 * Persisted view preferences.
 *
 * Two things matter: a stored value that is no longer a valid option must not
 * strand the view in a state the UI cannot undo, and storage being unavailable
 * must never break the page — a private window or blocked site data makes
 * localStorage throw on access, not return null.
 */
import { renderHook, act } from '@testing-library/react';
import { usePersistedState, oneOf, isBoolean } from '../usePersistedState';

const isGroup = oneOf('none', 'person', 'list');

beforeEach(() => window.localStorage.clear());

describe('usePersistedState', () => {
  it('starts from the initial value when nothing is stored', () => {
    const { result } = renderHook(() => usePersistedState('k', 'none', isGroup));
    expect(result.current[0]).toBe('none');
  });

  it('writes the value so a later mount reads it back', () => {
    const { result } = renderHook(() => usePersistedState('k', 'none', isGroup));
    act(() => result.current[1]('person'));

    const second = renderHook(() => usePersistedState('k', 'none', isGroup));
    expect(second.result.current[0]).toBe('person');
  });

  it('falls back to the initial value when the stored option no longer exists', () => {
    // e.g. a grouping that was removed from the UI in a later release.
    window.localStorage.setItem('k', JSON.stringify('by-colour'));
    const { result } = renderHook(() => usePersistedState('k', 'none', isGroup));
    expect(result.current[0]).toBe('none');
  });

  it('falls back when the stored value is not even JSON', () => {
    window.localStorage.setItem('k', 'not json');
    const { result } = renderHook(() => usePersistedState('k', 'none', isGroup));
    expect(result.current[0]).toBe('none');
  });

  it('survives localStorage throwing on read', () => {
    const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => usePersistedState('k', 'none', isGroup));
    expect(result.current[0]).toBe('none');
    spy.mockRestore();
  });

  it('survives localStorage throwing on write', () => {
    const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const { result } = renderHook(() => usePersistedState('k', 'none', isGroup));
    expect(() => act(() => result.current[1]('list'))).not.toThrow();
    expect(result.current[0]).toBe('list');
    spy.mockRestore();
  });

  it('handles booleans, which JSON round-trips differently from strings', () => {
    const { result } = renderHook(() => usePersistedState('done', false, isBoolean));
    act(() => result.current[1](true));
    const second = renderHook(() => usePersistedState('done', false, isBoolean));
    expect(second.result.current[0]).toBe(true);
  });
});
