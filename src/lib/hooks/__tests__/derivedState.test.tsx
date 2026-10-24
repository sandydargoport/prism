/**
 * @jest-environment jsdom
 */

/**
 * State that follows other state is worked out in the same render, so no
 * render shows the old value next to the new one (#447).
 */

import { useLayoutEffect } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useLocationSearch } from '../useLocationSearch';
import { useShoppingCelebration } from '@/app/shopping/useShoppingCelebration';
import { useGoalCelebration } from '@/app/goals/useGoalCelebration';
import type { Goal } from '../useGoals';

describe('useLocationSearch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    global.fetch = jest.fn((url: string) => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(
        String(url).startsWith('/api/location-search')
          ? { results: [{ displayName: 'Springfield', lat: 1, lon: 2 }] }
          : { settings: {} },
      ),
    })) as unknown as typeof fetch;
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('a query cut below two characters lists nothing in the same render', async () => {
    const seen: { query: string; count: number; open: boolean }[] = [];
    const { result } = renderHook(() => {
      const r = useLocationSearch();
      useLayoutEffect(() => { seen.push({ query: r.query, count: r.candidates.length, open: r.open }); });
      return r;
    });

    act(() => { result.current.setQuery('spr'); });
    await act(async () => { jest.advanceTimersByTime(400); });
    await waitFor(() => expect(result.current.candidates).toHaveLength(1));
    expect(result.current.open).toBe(true);

    act(() => { result.current.setQuery('s'); });

    const short = seen.filter((s) => s.query === 's');
    expect(short.length).toBeGreaterThan(0);
    for (const s of short) expect(s.count).toBe(0);
  });
});

describe('useShoppingCelebration', () => {
  function setup(listId: string, checked: number, total: number) {
    return renderHook(
      ({ id, c, t }) => useShoppingCelebration(id, c, t),
      { initialProps: { id: listId, c: checked, t: total } },
    );
  }

  it('celebrates checking off the last item', () => {
    const { result, rerender } = setup('a', 2, 3);
    rerender({ id: 'a', c: 3, t: 3 });
    expect(result.current.showCelebration).toBe(true);
  });

  it('does not celebrate a list that opens already complete', () => {
    const { result, rerender } = setup('a', 0, 0);
    rerender({ id: 'a', c: 3, t: 3 });
    expect(result.current.showCelebration).toBe(false);
  });

  it('does not celebrate switching to a complete list', () => {
    const { result, rerender } = setup('a', 1, 3);
    rerender({ id: 'b', c: 2, t: 2 });
    expect(result.current.showCelebration).toBe(false);
  });

  it('does not celebrate removing the last unchecked item', () => {
    const { result, rerender } = setup('a', 2, 3);
    rerender({ id: 'a', c: 2, t: 2 });
    expect(result.current.showCelebration).toBe(false);
  });
});

describe('useGoalCelebration', () => {
  const goal = (id: string, fullyAchieved: boolean) =>
    ({ id, name: `Goal ${id}`, fullyAchieved }) as unknown as Goal;

  beforeEach(() => sessionStorage.clear());

  it('starts in the same render that sees the goal achieved', () => {
    // Committed renders only: a render React restarts never reaches the screen.
    const seen: (string | null)[] = [];
    const { rerender } = renderHook(({ goals }) => {
      const r = useGoalCelebration(goals);
      useLayoutEffect(() => { seen.push(r.celebratingGoal); });
      return r;
    }, { initialProps: { goals: [goal('1', false)] } });

    seen.length = 0;
    rerender({ goals: [goal('1', true)] });
    expect(seen.at(-1)).toBe('Goal 1');
    expect(seen.every((name) => name === 'Goal 1')).toBe(true);
  });

  it('celebrates once per session, one at a time', () => {
    const { result, rerender, unmount } = renderHook(({ goals }) => useGoalCelebration(goals), {
      initialProps: { goals: [goal('1', true), goal('2', true)] },
    });
    expect(result.current.celebratingGoal).toBe('Goal 1');
    act(() => result.current.finish());
    expect(result.current.celebratingGoal).toBe('Goal 2');
    act(() => result.current.finish());
    rerender({ goals: [goal('1', true), goal('2', true)] });
    expect(result.current.celebratingGoal).toBeNull();
    unmount();

    // Navigating back in the same session does not repeat it.
    const again = renderHook(() => useGoalCelebration([goal('1', true), goal('2', true)]));
    expect(again.result.current.celebratingGoal).toBeNull();
  });

  it('celebrates again after the goal is reset and achieved again', () => {
    const { result, rerender } = renderHook(({ goals }) => useGoalCelebration(goals), {
      initialProps: { goals: [goal('1', true)] },
    });
    act(() => result.current.finish());
    rerender({ goals: [goal('1', false)] });
    expect(result.current.celebratingGoal).toBeNull();
    rerender({ goals: [goal('1', true)] });
    expect(result.current.celebratingGoal).toBe('Goal 1');
  });

  it('an empty list while loading does not forget what was celebrated', () => {
    const first = renderHook(() => useGoalCelebration([goal('1', true)]));
    act(() => first.result.current.finish());
    first.unmount();

    const { result, rerender } = renderHook(({ goals }) => useGoalCelebration(goals), {
      initialProps: { goals: [] as Goal[] },
    });
    rerender({ goals: [goal('1', true)] });
    expect(result.current.celebratingGoal).toBeNull();
  });
});
