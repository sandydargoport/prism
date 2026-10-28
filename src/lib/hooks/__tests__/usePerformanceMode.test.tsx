/**
 * @jest-environment jsdom
 */
/**
 * Performance mode lives in localStorage and shows as a class on <html>. The
 * inline script in app/layout.tsx sets the class before the first paint, so
 * the hook must never take it away while it is still hydrating with the
 * server's "off".
 */
import { createElement } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderHook, act } from '@testing-library/react';
import { useAutoPerformance, usePerformanceMode } from '../usePerformanceMode';
import { usePollingInterval, PERF_MODE_POLL_STRETCH } from '../usePollingInterval';

const KEY = 'prism-perf-mode';
const root = document.documentElement;

beforeEach(() => {
  localStorage.clear();
  window.dispatchEvent(new StorageEvent('storage', { key: null }));
  root.classList.remove('performance-mode', 'perf-minimal');
  window.history.replaceState(null, '', '/');
});

describe('usePerformanceMode', () => {
  it('keeps the class the inline script set, through hydration', async () => {
    localStorage.setItem(KEY, 'true');
    root.classList.add('performance-mode'); // what the inline script does

    // Every change, in order. Looking at the class afterwards would miss a
    // removal that was put back a moment later, which is still a flash.
    const toggle = jest.spyOn(root.classList, 'toggle');

    function Probe() {
      const { level } = usePerformanceMode();
      return createElement('span', null, level);
    }
    const container = document.createElement('div');
    container.innerHTML = '<span>full</span>';
    await act(async () => {
      hydrateRoot(container, createElement(Probe));
    });

    expect(container.textContent).toBe('reduced');
    expect(toggle).not.toHaveBeenCalledWith('performance-mode', false);
    toggle.mockRestore();
    expect(root.classList.contains('performance-mode')).toBe(true);
  });

  it('only the minimal level stretches polling, and a change reaches another component', () => {
    localStorage.setItem(KEY, 'full');
    const perf = renderHook(() => usePerformanceMode());
    const poll = renderHook(() => usePollingInterval(1000));
    expect(poll.result.current).toBe(1000);

    act(() => perf.result.current.setMode('reduced'));
    expect(poll.result.current).toBe(1000);
    expect(root.classList.contains('performance-mode')).toBe(true);
    expect(root.classList.contains('perf-minimal')).toBe(false);

    act(() => perf.result.current.setMode('minimal'));
    expect(poll.result.current).toBe(Math.round(1000 * PERF_MODE_POLL_STRETCH));
    expect(root.classList.contains('perf-minimal')).toBe(true);
  });

  it('the old on/off values keep meaning what they did', () => {
    localStorage.setItem(KEY, 'true');
    const { result } = renderHook(() => usePerformanceMode());
    expect(result.current).toMatchObject({ mode: 'reduced', level: 'reduced' });
    act(() => {
      localStorage.setItem(KEY, 'false');
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    });
    expect(result.current.level).toBe('full');
  });

  it('nothing stored is Auto, running at what it measured, Full until then', () => {
    const { result } = renderHook(() => usePerformanceMode());
    expect(result.current).toMatchObject({ mode: 'auto', level: 'full' });
    expect(localStorage.getItem(KEY)).toBeNull(); // no guess written any more
    act(() => {
      localStorage.setItem('prism-perf-auto-level', 'minimal');
      window.dispatchEvent(new StorageEvent('storage', { key: 'prism-perf-auto-level' }));
    });
    expect(result.current).toMatchObject({ mode: 'auto', level: 'minimal' });
  });

  it('?perf=1 still means reduced, persists it, and drops the parameter', () => {
    localStorage.setItem(KEY, 'false');
    window.history.replaceState(null, '', '/?perf=1&x=2');
    const { result } = renderHook(() => usePerformanceMode());
    expect(result.current.level).toBe('reduced');
    expect(localStorage.getItem(KEY)).toBe('reduced');
    expect(window.location.search).toBe('?x=2');
  });

  it('?perf=minimal sets that level', () => {
    window.history.replaceState(null, '', '/?perf=minimal');
    const { result } = renderHook(() => usePerformanceMode());
    expect(result.current.level).toBe('minimal');
    expect(window.location.search).toBe('');
  });
});

describe('useAutoPerformance', () => {
  // Frames 100 ms apart: every one of them slow.
  let now = 0;
  beforeEach(() => {
    now = 0;
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      now += 100;
      setTimeout(() => cb(now), 0);
      return 0;
    });
  });
  afterEach(() => jest.restoreAllMocks());

  async function fade(rerender: (props: { idle: boolean }) => void, idle: boolean) {
    rerender({ idle });
    await act(async () => { await new Promise(r => setTimeout(r, 200)); });
  }

  it('steps Auto down after three choppy fades in a row, not before', async () => {
    const { rerender } = renderHook(({ idle }) => useAutoPerformance(idle), { initialProps: { idle: false } });
    await fade(rerender, true);
    await fade(rerender, false);
    expect(localStorage.getItem('prism-perf-auto-level')).toBeNull();
    await fade(rerender, true);
    expect(localStorage.getItem('prism-perf-auto-level')).toBe('reduced');
  });

  it('leaves a level chosen by hand alone', async () => {
    localStorage.setItem(KEY, 'full');
    const { rerender } = renderHook(({ idle }) => useAutoPerformance(idle), { initialProps: { idle: false } });
    for (const idle of [true, false, true, false]) await fade(rerender, idle);
    expect(localStorage.getItem('prism-perf-auto-level')).toBeNull();
  });
});
