/**
 * @jest-environment jsdom
 */

/**
 * Tests for useVisibilityPolling hook using renderHook.
 *
 * Tests interval setup, pause on hidden, immediate resume on visible,
 * cleanup on unmount, and disabled behavior.
 */

import { createElement, type ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { useVisibilityPolling } from '../useVisibilityPolling';
import { setDisplayIdle } from '../useDisplayIdle';
import { PollingScopeContext } from '../pollingScope';

// Helper to simulate visibilitychange
function setDocumentHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', {
    value: hidden,
    writable: true,
    configurable: true,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useVisibilityPolling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(document, 'hidden', {
      value: false,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    act(() => setDisplayIdle(false));
  });

  it('calls callback at the specified interval', () => {
    const callback = jest.fn();
    renderHook(() => useVisibilityPolling(callback, 5000));

    expect(callback).not.toHaveBeenCalled();

    jest.advanceTimersByTime(5000);
    expect(callback).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(5000);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('does not set up interval when intervalMs is 0', () => {
    const callback = jest.fn();
    renderHook(() => useVisibilityPolling(callback, 0));

    jest.advanceTimersByTime(30000);
    expect(callback).not.toHaveBeenCalled();
  });

  it('does not set up interval for negative intervalMs', () => {
    const callback = jest.fn();
    renderHook(() => useVisibilityPolling(callback, -100));

    jest.advanceTimersByTime(30000);
    expect(callback).not.toHaveBeenCalled();
  });

  it('pauses polling when page becomes hidden', () => {
    const callback = jest.fn();
    renderHook(() => useVisibilityPolling(callback, 1000));

    jest.advanceTimersByTime(2000);
    expect(callback).toHaveBeenCalledTimes(2);

    setDocumentHidden(true);

    jest.advanceTimersByTime(5000);
    expect(callback).toHaveBeenCalledTimes(2); // No new calls
  });

  it('fires callback immediately when page becomes visible again', () => {
    const callback = jest.fn();
    renderHook(() => useVisibilityPolling(callback, 1000));

    setDocumentHidden(true);
    callback.mockClear();

    setDocumentHidden(false);

    // Should fire immediately on becoming visible
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('resumes interval after becoming visible', () => {
    const callback = jest.fn();
    renderHook(() => useVisibilityPolling(callback, 1000));

    setDocumentHidden(true);
    callback.mockClear();

    setDocumentHidden(false);
    expect(callback).toHaveBeenCalledTimes(1); // immediate call

    jest.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(2); // interval resumes
  });

  it('cleans up interval and event listener on unmount', () => {
    const callback = jest.fn();
    const removeSpy = jest.spyOn(document, 'removeEventListener');
    const { unmount } = renderHook(() => useVisibilityPolling(callback, 1000));

    unmount();

    // No more callbacks after unmount
    callback.mockClear();
    jest.advanceTimersByTime(5000);
    expect(callback).not.toHaveBeenCalled();

    // Event listener was removed
    const removeCall = removeSpy.mock.calls.find(
      (call) => call[0] === 'visibilitychange'
    );
    expect(removeCall).toBeTruthy();

    removeSpy.mockRestore();
  });

  it('registers visibilitychange listener on document', () => {
    const addSpy = jest.spyOn(document, 'addEventListener');
    const callback = jest.fn();

    renderHook(() => useVisibilityPolling(callback, 3000));

    const addCall = addSpy.mock.calls.find(
      (call) => call[0] === 'visibilitychange'
    );
    expect(addCall).toBeTruthy();

    addSpy.mockRestore();
  });
});

describe('useVisibilityPolling while the display is idle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(document, 'hidden', {
      value: false,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    act(() => setDisplayIdle(false));
  });

  const inScreensaver = ({ children }: { children: ReactNode }) =>
    createElement(PollingScopeContext.Provider, { value: 'screensaver' as const }, children);

  it('pauses when the screensaver comes up', () => {
    const callback = jest.fn();
    renderHook(() => useVisibilityPolling(callback, 1000));

    jest.advanceTimersByTime(2000);
    expect(callback).toHaveBeenCalledTimes(2);

    act(() => setDisplayIdle(true));

    jest.advanceTimersByTime(10_000);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('refreshes exactly once on wake, not once per missed tick', () => {
    const callback = jest.fn();
    renderHook(() => useVisibilityPolling(callback, 1000));

    act(() => setDisplayIdle(true));
    // Long enough to have missed sixty ticks.
    jest.advanceTimersByTime(60_000);
    callback.mockClear();

    act(() => setDisplayIdle(false));
    expect(callback).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('keeps the screensaver\'s own widgets polling', () => {
    const callback = jest.fn();
    renderHook(() => useVisibilityPolling(callback, 1000), { wrapper: inScreensaver });

    act(() => setDisplayIdle(true));

    jest.advanceTimersByTime(3000);
    expect(callback).toHaveBeenCalledTimes(3);
  });

  it('still pauses screensaver widgets when the tab itself is hidden', () => {
    const callback = jest.fn();
    renderHook(() => useVisibilityPolling(callback, 1000), { wrapper: inScreensaver });

    setDocumentHidden(true);
    callback.mockClear();

    jest.advanceTimersByTime(5000);
    expect(callback).not.toHaveBeenCalled();
  });

  it('keeps polling for a caller that opted out of the idle pause', () => {
    const callback = jest.fn();
    renderHook(() => useVisibilityPolling(callback, 1000, { pollWhileIdle: true }));

    act(() => setDisplayIdle(true));

    jest.advanceTimersByTime(3000);
    expect(callback).toHaveBeenCalledTimes(3);
  });

  it('does not fire a catch-up on mount', () => {
    const callback = jest.fn();
    renderHook(() => useVisibilityPolling(callback, 1000));
    expect(callback).not.toHaveBeenCalled();
  });
});
