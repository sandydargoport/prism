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
import { usePerformanceMode } from '../usePerformanceMode';
import { usePollingInterval, PERF_MODE_POLL_STRETCH } from '../usePollingInterval';

const KEY = 'prism-perf-mode';
const root = document.documentElement;

beforeEach(() => {
  localStorage.clear();
  window.dispatchEvent(new StorageEvent('storage', { key: null }));
  root.classList.remove('performance-mode');
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
      const { enabled } = usePerformanceMode();
      return createElement('span', null, String(enabled));
    }
    const container = document.createElement('div');
    container.innerHTML = '<span>false</span>';
    await act(async () => {
      hydrateRoot(container, createElement(Probe));
    });

    expect(container.textContent).toBe('true');
    expect(toggle).not.toHaveBeenCalledWith('performance-mode', false);
    toggle.mockRestore();
    expect(root.classList.contains('performance-mode')).toBe(true);
  });

  it('a toggle reaches the polling interval of another component', () => {
    localStorage.setItem(KEY, 'false');
    const toggle = renderHook(() => usePerformanceMode());
    const poll = renderHook(() => usePollingInterval(1000));
    expect(poll.result.current).toBe(1000);

    act(() => toggle.result.current.setEnabled(true));
    expect(poll.result.current).toBe(Math.round(1000 * PERF_MODE_POLL_STRETCH));
    expect(root.classList.contains('performance-mode')).toBe(true);
  });

  it('?perf=1 turns it on, persists it, and drops the parameter', () => {
    localStorage.setItem(KEY, 'false');
    window.history.replaceState(null, '', '/?perf=1&x=2');
    const { result } = renderHook(() => usePerformanceMode());
    expect(result.current.enabled).toBe(true);
    expect(localStorage.getItem(KEY)).toBe('true');
    expect(window.location.search).toBe('?x=2');
  });
});
