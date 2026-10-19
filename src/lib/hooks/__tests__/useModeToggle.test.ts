/**
 * @jest-environment jsdom
 */

/**
 * The house-wide mode toggles (Babysitter, Away) are read by several
 * independent components at once — the overlay that performs the change and the
 * dashboard button are different instances with their own copy of the state.
 * A change therefore has to broadcast so the others refresh instead of waiting
 * out their poll interval. Enabling used to dispatch that from the button and
 * exiting forgot to, so the button stayed hidden for up to a poll after exit
 * (#665). The broadcast now lives in toggle() itself, on the one path every
 * change flows through; these tests pin that.
 */

import { renderHook, act } from '@testing-library/react';

// Stub useFetch so the test exercises only useModeToggle's own logic (the POST,
// the local update, the broadcast) and not the polling/caching machinery.
const setData = jest.fn();
const refresh = jest.fn();
jest.mock('../useFetch', () => ({
  useFetch: () => ({
    data: { enabled: false, enabledAt: null, enabledBy: null },
    setData,
    loading: false,
    error: null,
    refresh,
  }),
}));

import { useModeToggle } from '../useModeToggle';

const opts = {
  endpoint: '/api/babysitter-mode',
  eventName: 'prism:babysitter-mode-change',
  label: 'babysitter mode',
};

describe('useModeToggle broadcast', () => {
  beforeEach(() => {
    setData.mockClear();
    refresh.mockClear();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: false, enabledAt: null, enabledBy: null }),
    });
  });

  it.each([
    ['exit', false],
    ['enter', true],
  ])('broadcasts the change event when toggling %s (#665)', async (_label, enabled) => {
    const listener = jest.fn();
    window.addEventListener(opts.eventName, listener);
    const { result } = renderHook(() => useModeToggle(opts));

    await act(async () => {
      await result.current.toggle(enabled);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      opts.endpoint,
      expect.objectContaining({ method: 'POST' })
    );
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(opts.eventName, listener);
  });

  it('does not broadcast when the toggle request fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'nope' }),
    });
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const listener = jest.fn();
    window.addEventListener(opts.eventName, listener);
    const { result } = renderHook(() => useModeToggle(opts));

    await act(async () => {
      await expect(result.current.toggle(true)).rejects.toThrow();
    });

    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener(opts.eventName, listener);
    consoleError.mockRestore();
  });
});
