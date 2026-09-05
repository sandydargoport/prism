/**
 * @jest-environment jsdom
 */
/**
 * Telling "the settings have not been read yet" apart from "motion is off".
 *
 * These settings live in localStorage, which cannot be read while rendering, so
 * for one paint every value is still its default — and the default for motion
 * is 'off', which means "show every widget". The screensaver therefore came up
 * with a full board and then drained all of it away at once as the real setting
 * arrived, which is the opposite of the intended empty start. `ready` is what
 * lets the grid hold back for that one frame.
 *
 * The dangerous failure is the other direction: a `ready` that never becomes
 * true leaves the screensaver permanently blank on every display in the house.
 * So it must survive localStorage being unavailable — a browser with site data
 * blocked — which is exactly why it is set outside the try/catch.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useScreensaverMotion } from '../useScreensaverMotion';

afterEach(() => { jest.restoreAllMocks(); localStorage.clear(); });

describe('useScreensaverMotion ready flag', () => {
  it('is false on the very first render, before storage has been read', () => {
    localStorage.setItem('prism-screensaver-motion', 'liquid');
    let readyAtFirstRender: boolean | null = null;

    renderHook(() => {
      const s = useScreensaverMotion();
      if (readyAtFirstRender === null) readyAtFirstRender = s.ready;
      return s;
    });

    expect(readyAtFirstRender).toBe(false);
  });

  it('becomes true once the settings are read', async () => {
    localStorage.setItem('prism-screensaver-motion', 'liquid');

    const { result } = renderHook(() => useScreensaverMotion());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.motion).toBe('liquid');
  });

  it('becomes true even when nothing is stored, so an off display still draws', async () => {
    // The common case: a display that has never touched these settings. If
    // `ready` only flipped when a value was found, every such screensaver would
    // stay blank forever.
    const { result } = renderHook(() => useScreensaverMotion());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.motion).toBe('off');
  });

  it('becomes true even when localStorage throws, so the screensaver is never left blank', async () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('site data blocked');
    });

    const { result } = renderHook(() => useScreensaverMotion());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.motion).toBe('off');
  });

  it('reports the stored motion, not the default, by the time it is ready', async () => {
    // The whole point: at the moment the grid is allowed to draw, it must
    // already know this display animates, or it draws a full board it then has
    // to undo.
    localStorage.setItem('prism-screensaver-motion', 'fireworks');

    const { result } = renderHook(() => useScreensaverMotion());

    await act(async () => { await Promise.resolve(); });
    expect(result.current.ready).toBe(true);
    expect(result.current.motion).toBe('fireworks');
  });
});
