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
import { createElement } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderHook, act } from '@testing-library/react';
import {
  usePersistedState,
  useSessionScopedState,
  usePersistedStringSet,
  useSessionScopedStringSet,
  displayWentIdle,
  IDLE_FORGET_MS,
  oneOf,
  isBoolean,
} from '../usePersistedState';

const isGroup = oneOf('none', 'person', 'list');

beforeEach(() => {
  window.localStorage.clear();
  // What another tab clearing storage looks like; it also drops any value the
  // store is holding because a write was refused.
  window.dispatchEvent(new StorageEvent('storage', { key: null }));
});

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

describe('displayWentIdle', () => {
  it('is false when the display was just touched', () => {
    window.localStorage.setItem('prism-last-activity', String(Date.now()));
    expect(displayWentIdle()).toBe(false);
  });

  it('is true once the display has sat untouched past the threshold', () => {
    window.localStorage.setItem('prism-last-activity', String(Date.now() - IDLE_FORGET_MS - 1000));
    expect(displayWentIdle()).toBe(true);
  });

  it('is false when no activity was ever recorded', () => {
    // A browser that has never run the screensaver must not lose its filter on
    // every single load.
    expect(displayWentIdle()).toBe(false);
  });

  it('is false when the stored value is nonsense rather than a number', () => {
    window.localStorage.setItem('prism-last-activity', 'yesterday');
    expect(displayWentIdle()).toBe(false);
  });
});

describe('useSessionScopedState', () => {
  const isListFilter = (v: unknown): v is string | null => v === null || typeof v === 'string';

  it('keeps the value across a reload during active use', () => {
    window.localStorage.setItem('prism-last-activity', String(Date.now()));
    window.localStorage.setItem('f', JSON.stringify('list-1'));

    const { result } = renderHook(() => useSessionScopedState<string | null>('f', null, isListFilter));
    expect(result.current[0]).toBe('list-1');
  });

  it('forgets it after the display has been idle', () => {
    // The screensaver has been and gone. Walking up to a list that silently
    // hides most of its tasks reads as data loss.
    window.localStorage.setItem('prism-last-activity', String(Date.now() - IDLE_FORGET_MS - 1000));
    window.localStorage.setItem('f', JSON.stringify('list-1'));

    const { result } = renderHook(() => useSessionScopedState<string | null>('f', null, isListFilter));
    expect(result.current[0]).toBeNull();
  });

  it('forgetting is a real write, so the next load agrees', () => {
    window.localStorage.setItem('prism-last-activity', String(Date.now() - IDLE_FORGET_MS - 1000));
    window.localStorage.setItem('f', JSON.stringify('list-1'));
    renderHook(() => useSessionScopedState<string | null>('f', null, isListFilter));

    expect(JSON.parse(window.localStorage.getItem('f')!)).toBeNull();
  });
});

/**
 * A Set does not survive JSON — it serialises to `{}` — so storing one
 * directly would come back empty and silently show everything, which on a
 * filter reads as the filter having been cleared by itself.
 */
describe('usePersistedStringSet', () => {
  it('round-trips a Set through storage', () => {
    const { result } = renderHook(() => usePersistedStringSet('s'));
    act(() => result.current[1](new Set(['b', 'a'])));

    const second = renderHook(() => usePersistedStringSet('s'));
    expect([...second.result.current[0]].sort()).toEqual(['a', 'b']);
  });

  it('does not store a Set as an empty object', () => {
    const { result } = renderHook(() => usePersistedStringSet('s'));
    act(() => result.current[1](new Set(['x'])));
    expect(window.localStorage.getItem('s')).toBe('["x"]');
  });

  it('accepts an updater, like useState', () => {
    const { result } = renderHook(() => usePersistedStringSet('s', ['a']));
    act(() => result.current[1]((prev) => new Set([...prev, 'b'])));
    expect([...result.current[0]].sort()).toEqual(['a', 'b']);
  });

  it('drops stored members that are no longer valid options', () => {
    window.localStorage.setItem('s', JSON.stringify(['breakfast', 'brunch']));
    const isMeal = oneOf('breakfast', 'lunch');
    const { result } = renderHook(() => usePersistedStringSet('s', [], isMeal));
    // One bad member invalidates the stored value rather than being silently
    // kept: a half-valid filter is still a filter the UI cannot fully undo.
    expect([...result.current[0]]).toEqual([]);
  });

  it('survives storage being unavailable', () => {
    const spy = jest.spyOn(window.localStorage.__proto__, 'getItem')
      .mockImplementation(() => { throw new Error('blocked'); });
    const { result } = renderHook(() => usePersistedStringSet('s', ['a']));
    expect([...result.current[0]]).toEqual(['a']);
    spy.mockRestore();
  });
});

describe('useSessionScopedStringSet', () => {
  it('forgets the Set once the display has been idle', () => {
    window.localStorage.setItem('s', JSON.stringify(['a']));
    window.localStorage.setItem('prism-last-activity', String(Date.now() - IDLE_FORGET_MS - 1));
    const { result } = renderHook(() => useSessionScopedStringSet('s'));
    expect([...result.current[0]]).toEqual([]);
  });

  it('keeps the Set across a reload during active use', () => {
    window.localStorage.setItem('s', JSON.stringify(['a']));
    window.localStorage.setItem('prism-last-activity', String(Date.now()));
    const { result } = renderHook(() => useSessionScopedStringSet('s'));
    expect([...result.current[0]]).toEqual(['a']);
  });
});

/**
 * Hydration and first paint.
 *
 * The server has no localStorage, so it always renders the default. During
 * hydration the hook must render that same default (a mismatch is React error
 * #418, which throws the tree away), and then the stored value. On a
 * client-side mount there is no server markup to match, so the stored value
 * belongs on the very first render, not one render later.
 */
describe('hydration safety', () => {
  it('does not clobber a stored value on mount', () => {
    window.localStorage.setItem('k', JSON.stringify('person'));
    renderHook(() => usePersistedState('k', 'none', isGroup));
    expect(window.localStorage.getItem('k')).toBe(JSON.stringify('person'));
  });

  it('has the stored value on the first render of a client-side mount', () => {
    // Opening the Tasks page from the nav must not draw the default grouping
    // for a frame and then redraw with the saved one.
    window.localStorage.setItem('k', JSON.stringify('person'));
    const seen: string[] = [];
    renderHook(() => {
      const [v] = usePersistedState('k', 'none', isGroup);
      seen.push(v);
    });
    expect(seen[0]).toBe('person');
    expect(seen).not.toContain('none');
  });

  it('hydrates the server markup without a mismatch, then shows the stored value', async () => {
    window.localStorage.setItem('k', JSON.stringify('person'));
    function Grouping() {
      const [v] = usePersistedState('k', 'none', isGroup);
      return createElement('span', null, v);
    }
    const container = document.createElement('div');
    // What the server sends: it cannot see storage, so it renders the default.
    container.innerHTML = '<span>none</span>';

    const errors: unknown[] = [];
    await act(async () => {
      hydrateRoot(container, createElement(Grouping), {
        onRecoverableError: (e) => errors.push(e),
      });
    });
    expect(errors).toEqual([]);
    expect(container.textContent).toBe('person');
  });

  it('a changed value is written after hydration', () => {
    const { result } = renderHook(() => usePersistedState('k', 'none', isGroup));
    act(() => result.current[1]('list'));
    expect(window.localStorage.getItem('k')).toBe(JSON.stringify('list'));
  });

  it('a change through one hook reaches another mounted on the same key', () => {
    // e.g. the screensaver's quick settings and the Settings page both open.
    const a = renderHook(() => usePersistedState('k', 'none', isGroup));
    const b = renderHook(() => usePersistedState('k', 'none', isGroup));
    act(() => a.result.current[1]('list'));
    expect(b.result.current[0]).toBe('list');
  });

  it('two updaters in one batch build on each other', () => {
    const { result } = renderHook(() => usePersistedStringSet('s'));
    act(() => {
      result.current[1]((prev) => new Set([...prev, 'a']));
      result.current[1]((prev) => new Set([...prev, 'b']));
    });
    expect([...result.current[0]]).toEqual(['a', 'b']);
  });

  it('keeps the same Set while nothing changed, so it is safe in deps', () => {
    window.localStorage.setItem('s', JSON.stringify(['a']));
    const { result, rerender } = renderHook(() => usePersistedStringSet('s'));
    const first = result.current[0];
    rerender();
    expect(result.current[0]).toBe(first);
  });

  it('tolerates a validator whose identity changes every render', () => {
    window.localStorage.setItem('k', JSON.stringify('person'));
    // An inline arrow is the normal call-site shape; a re-read on every render
    // would be wasteful and would fight any local edit.
    const { result, rerender } = renderHook(() =>
      usePersistedState('k', 'none', (v): v is string => typeof v === 'string'),
    );
    expect(result.current[0]).toBe('person');
    act(() => result.current[1]('none'));
    rerender();
    expect(result.current[0]).toBe('none');
  });
});
