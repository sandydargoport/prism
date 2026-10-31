/**
 * @jest-environment jsdom
 *
 * Removing a birthday shows at once on this screen, and other screens pick it
 * up within five minutes.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useBirthdays, removeBirthday } from '../useBirthdays';
import { navCacheInvalidate } from '@/lib/utils/navCache';

const polledEvery: number[] = [];
jest.mock('../useVisibilityPolling', () => ({
  useVisibilityPolling: (_fn: unknown, interval: number) => { polledEvery.push(interval); },
}));

const row = (id: string) => ({
  id, name: `Person ${id}`, birthDate: '2000-01-01', eventType: 'birthday', age: 26, daysUntil: 5, nextBirthday: '2026-11-05',
});

let list = [row('a'), row('b')];
const json = (body: unknown, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);

beforeEach(() => {
  list = [row('a'), row('b')];
  polledEvery.length = 0;
  navCacheInvalidate(/.*/);
  global.fetch = jest.fn((url: string, init?: RequestInit) => {
    if (init?.method === 'DELETE') {
      const id = url.split('/').pop();
      list = list.filter((b) => b.id !== id);
      return json({});
    }
    return json({ birthdays: list });
  }) as unknown as typeof fetch;
});

describe('useBirthdays', () => {
  it('reloads as soon as a birthday is removed on this screen', async () => {
    const { result } = renderHook(() => useBirthdays({ limit: 8 }));
    await waitFor(() => expect(result.current.birthdays.map((b) => b.id)).toEqual(['a', 'b']));

    let ok = false;
    await act(async () => { ok = await removeBirthday('a'); });
    expect(ok).toBe(true);
    await waitFor(() => expect(result.current.birthdays.map((b) => b.id)).toEqual(['b']));
  });

  it('does not reload when the removal fails', async () => {
    const { result } = renderHook(() => useBirthdays({ limit: 8 }));
    await waitFor(() => expect(result.current.birthdays).toHaveLength(2));
    (global.fetch as jest.Mock).mockImplementationOnce(() => json({}, false));
    const calls = (global.fetch as jest.Mock).mock.calls.length;
    let ok = true;
    await act(async () => { ok = await removeBirthday('a'); });
    expect(ok).toBe(false);
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(calls + 1);
  });

  it('checks for changes every five minutes', () => {
    renderHook(() => useBirthdays({ limit: 8 }));
    expect(polledEvery.at(-1)).toBe(5 * 60 * 1000);
  });
});
