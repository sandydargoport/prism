/**
 * @jest-environment jsdom
 */
/**
 * Telling "the settings have not been read yet" apart from "motion is off".
 *
 * During hydration every value is still the server's default, because the
 * server cannot see localStorage, and the default for motion is 'off', which
 * means "show every widget". The screensaver would come up with a full board
 * and then drain all of it away at once as the real setting arrived, which is
 * the opposite of the intended empty start. `ready` is what lets the grid hold
 * back for that one frame. On a client-side mount there is no such frame: the
 * stored values are there on the first render.
 *
 * The dangerous failure is the other direction: a `ready` that never becomes
 * true leaves the screensaver permanently blank on every display in the house.
 * So it must survive localStorage being unavailable, a browser with site data
 * blocked.
 */
import { createElement } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useScreensaverMotion } from '../useScreensaverMotion';

afterEach(() => { jest.restoreAllMocks(); localStorage.clear(); });

describe('useScreensaverMotion ready flag', () => {
  it('is false while hydrating, then true with the stored motion', async () => {
    localStorage.setItem('prism-screensaver-motion', 'liquid');
    function Probe() {
      const s = useScreensaverMotion();
      return createElement('span', null, s.ready ? s.motion : 'not-ready');
    }
    const container = document.createElement('div');
    // The server cannot see storage, so it sends the not-ready markup.
    container.innerHTML = '<span>not-ready</span>';
    const errors: unknown[] = [];
    await act(async () => {
      hydrateRoot(container, createElement(Probe), { onRecoverableError: (e) => errors.push(e) });
    });
    expect(errors).toEqual([]);
    expect(container.textContent).toBe('liquid');
  });

  it('has the stored motion on the first render of a client-side mount', () => {
    // Opening the screensaver after the page has loaded must not wait a
    // render to learn this display animates.
    localStorage.setItem('prism-screensaver-motion', 'liquid');
    const first: { ready: boolean; motion: string }[] = [];
    renderHook(() => {
      const s = useScreensaverMotion();
      first.push({ ready: s.ready, motion: s.motion });
      return s;
    });
    expect(first[0]).toEqual({ ready: true, motion: 'liquid' });
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
