/**
 * @jest-environment jsdom
 */
/**
 * Settings → Features decides the dock. A change reaches the dock on the same
 * screen at once (#1172), and a switched-off page does not hold one of the
 * five places (#1173).
 */
import { render, screen, fireEvent, act, renderHook, waitFor } from '@testing-library/react';
import { FeaturesSection } from '../FeaturesSection';
import { useHiddenPages } from '@/lib/hooks/useHiddenPages';

let saved: { hiddenPages: string[]; dockPages: string[] | null };

beforeEach(() => {
  window.localStorage.clear();
  saved = { hiddenPages: [], dockPages: null };
  global.fetch = jest.fn(async (_url: unknown, init?: RequestInit) => {
    if (init?.method === 'PATCH') return { ok: true, json: async () => ({}) } as Response;
    return {
      ok: true,
      json: async () => ({ settings: { hiddenPages: saved.hiddenPages, dockPages: saved.dockPages } }),
    } as Response;
  }) as jest.Mock;
});

const box = (href: string) => document.querySelector(`[data-dock-choice="${href}"]`) as HTMLInputElement;

describe('Settings → Features and the dock', () => {
  it('tells the dock on the same screen at once (#1172)', async () => {
    saved.dockPages = ['/', '/calendar', '/tasks'];
    const dock = renderHook(() => useHiddenPages());
    render(<FeaturesSection />);
    await waitFor(() => expect(box('/tasks')).toBeTruthy());
    await waitFor(() => expect(dock.result.current.dockPages).toEqual(['/', '/calendar', '/tasks']));

    act(() => { fireEvent.click(box('/tasks')); });
    expect(dock.result.current.dockPages).toEqual(['/', '/calendar']);

    act(() => { fireEvent.click(screen.getAllByRole('switch')[0]!); });
    expect(dock.result.current.hiddenPages).toHaveLength(1);
  });

  it('lets a fifth page be chosen when one of five is switched off (#1173)', async () => {
    saved.dockPages = ['/', '/calendar', '/tasks', '/chores', '/goals', '/shopping'];
    saved.hiddenPages = ['/goals'];
    render(<FeaturesSection />);
    await waitFor(() => expect(box('/meals')).toBeTruthy());

    expect(box('/goals').checked).toBe(false);
    expect(box('/meals').disabled).toBe(false);
    act(() => { fireEvent.click(box('/meals')); });
    expect(box('/meals').checked).toBe(true);
    expect(box('/recipes').disabled).toBe(true);
  });
});
