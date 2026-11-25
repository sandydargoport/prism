/**
 * @jest-environment jsdom
 *
 * One function answers "what is on this screen now" (#1344): the wall's
 * screensaver, Glance's night veil and the editor's preview all ask
 * `screenStateAt`, and each still shows what it showed before.
 */
import * as fs from 'fs';
import * as path from 'path';
import { act, renderHook } from '@testing-library/react';
import type { IdleBackground } from '@/lib/idleBackground';
import { canvasDarkness } from '@/lib/canvasScene';
import { serializeScreenDay } from '@/lib/screenDay';
import { setDashboardShown } from '../calmMode';

jest.mock('@/lib/throughTheDay', () => {
  const actual = jest.requireActual('@/lib/throughTheDay');
  return { ...actual, screenStateAt: jest.fn(actual.screenStateAt) };
});
jest.mock('../useIdleBackground', () => ({ useSkyLocation: () => ({ lat: 45, lon: -100 }) }));

import { screenStateAt } from '@/lib/throughTheDay';
import { usePreviewScene, useWallScene } from '../useScene';

const spy = screenStateAt as jest.MockedFunction<typeof screenStateAt>;
// Night by set times, so the test does not hang on the sun.
const bg = { day: 'dashboard', night: 'off', switch: { by: 'clock', from: '21:00', to: '06:30' } } satisfies IdleBackground;
const DAY = new Date(2026, 10, 5, 12);
const NIGHT = new Date(2026, 10, 5, 23);

beforeEach(() => {
  spy.mockClear();
  localStorage.clear();
  // The screen's own day (#1345), 50% darker at night.
  localStorage.setItem('prism-screen-day', serializeScreenDay({ ...bg, nightLevel: 50 }));
  setDashboardShown(true);
  jest.useFakeTimers();
});
afterEach(() => { jest.useRealTimers(); setDashboardShown(false); });

describe('the wall', () => {
  it('asks screenStateAt with idle, Away, Sitter, the time and the dim', () => {
    jest.setSystemTime(NIGHT);
    const { result } = renderHook(() => useWallScene({ idle: true, away: false, sitter: false }));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      idle: true, away: false, sitter: false, background: bg, dimLevel: 0.5,
      at: { now: NIGHT, lat: 45, lon: -100 },
    }));
    expect(result.current).toMatchObject({ state: 'night', night: true, look: 'off', dim: 0.5 });
  });

  it('keeps the dim off in Away, as before', () => {
    jest.setSystemTime(NIGHT);
    const { result } = renderHook(() => useWallScene({ idle: true, away: true, sitter: false }));
    expect(result.current).toMatchObject({ state: 'active', night: true, dim: 0 });
  });
});

describe('the wall idles by the screen\'s own day (#1345)', () => {
  const photosAllDay = serializeScreenDay({ day: 'photos', night: 'photos', switch: bg.switch, nightLevel: 25 });

  it('keeps the screen\'s look when a switch puts up a dashboard with another one', () => {
    localStorage.setItem('prism-screen-day', photosAllDay);
    jest.setSystemTime(DAY);
    const { result } = renderHook(() => useWallScene({ idle: true, away: false, sitter: false }));
    expect(result.current.look).toBe('photos');
    // The switch: another dashboard comes up. It is a dashboard on screen
    // like any other, and nothing it stores reaches the wall's scene.
    act(() => { setDashboardShown(false); setDashboardShown(true); });
    expect(result.current.look).toBe('photos');
    jest.setSystemTime(NIGHT);
    const { result: night } = renderHook(() => useWallScene({ idle: true, away: false, sitter: false }));
    expect(night.current).toMatchObject({ state: 'night', look: 'photos', dim: 0.25 });
  });

  it('follows a change to the screen\'s day, made here or from another device', () => {
    jest.setSystemTime(NIGHT);
    const { result } = renderHook(() => useWallScene({ idle: true, away: false, sitter: false }));
    expect(result.current.look).toBe('off');
    act(() => {
      localStorage.setItem('prism-screen-day', photosAllDay);
      window.dispatchEvent(new StorageEvent('storage', { key: 'prism-screen-day' }));
    });
    expect(result.current).toMatchObject({ look: 'photos', dim: 0.25 });
  });

  it('shows photos in place of the dashboard on a page with no dashboard', () => {
    act(() => { setDashboardShown(false); });
    jest.setSystemTime(DAY);
    const { result } = renderHook(() => useWallScene({ idle: true, away: false, sitter: false }));
    expect(result.current.look).toBe('photos');
  });
});

describe('Glance and the editor preview', () => {
  it('off the canvas, idles as the wall says and is night by the screen\'s rule', () => {
    for (const calmIdle of [false, true]) {
      for (const now of [DAY, NIGHT]) {
        jest.setSystemTime(now);
        const { result, unmount } = renderHook(() => usePreviewScene({ preview: null, calmIdle, background: bg }));
        expect(result.current.night).toBe(now === NIGHT);
        expect(result.current.clockNight).toBe(now === NIGHT);
        expect(result.current.state !== 'active').toBe(calmIdle);
        unmount();
      }
    }
  });

  // The canvas's toggles (#1348): each of the four states, whatever the time.
  it.each([
    [{ idle: false, night: false }, { state: 'active', night: false, look: 'dashboard', dim: 0 }],
    // Glance in use at night: its veil, and nothing darker.
    [{ idle: false, night: true }, { state: 'active', night: true, look: 'dashboard', dim: 0 }],
    [{ idle: true, night: false }, { state: 'resting', night: false, look: 'dashboard', dim: 0 }],
    [{ idle: true, night: true }, { state: 'night', night: true, look: 'off', dim: 0.5 }],
  ] as const)('the toggles at %j draw %j, by day and at night', (preview, drawn) => {
    for (const now of [DAY, NIGHT]) {
      jest.setSystemTime(now);
      spy.mockClear();
      const { result, unmount } = renderHook(() => usePreviewScene({ preview, calmIdle: false, background: bg }));
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ idle: preview.idle, at: { night: preview.night }, dimLevel: 0.5 }));
      expect(result.current).toMatchObject(drawn);
      // Day | Night starts from the clock, whatever the toggles say.
      expect(result.current.clockNight).toBe(now === NIGHT);
      unmount();
    }
  });

  it('dims every look at night, not only the dashboard (#1348)', () => {
    jest.setSystemTime(DAY);
    for (const look of ['dashboard', 'photos', 'sky'] as const) {
      const background: IdleBackground = { day: 'dashboard', night: look, switch: bg.switch };
      const { result, unmount } = renderHook(() => usePreviewScene({ preview: { idle: true, night: true }, calmIdle: false, background }));
      expect(result.current).toMatchObject({ state: 'night', look, dim: 0.5 });
      expect(canvasDarkness(result.current)).toEqual({ kind: 'dim', opacity: 0.5 });
      unmount();
    }
  });
});

describe('the callers', () => {
  const src = (p: string) => fs.readFileSync(path.join(__dirname, '..', '..', p), 'utf8');
  // Nothing else may work out idle, night, the look or the dim on its own.
  const ownRules = /\b(isNightAt|idleSourceAt|backdropFor|dimAt|useNightNow|useIdleSource)\s*\(/;

  it('the screensaver takes its scene from useWallScene', () => {
    const s = src('screensaver/Screensaver.tsx');
    expect(s).toMatch(/useWallScene\(/);
    expect(s).not.toMatch(ownRules);
  });

  it('no part of the wall reads a dashboard\'s idle look (#1345)', () => {
    for (const file of ['screensaver/Screensaver.tsx', 'screensaver/useScene.ts', 'dashboard/Dashboard.tsx', 'dashboard/useDashboardLayout.ts']) {
      expect(src(file)).not.toMatch(/\.idleBackground\b|parseIdleBackground/);
    }
  });

  it('the dashboard takes Glance\'s veil and the preview from usePreviewScene', () => {
    const s = src('dashboard/Dashboard.tsx');
    expect(s).toMatch(/usePreviewScene\(/);
    expect(s).toMatch(/night: sceneNight/);
    expect(s).not.toMatch(ownRules);
  });
});
