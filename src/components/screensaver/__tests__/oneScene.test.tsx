/**
 * @jest-environment jsdom
 *
 * One function answers "what is on this screen now" (#1344): the wall's
 * screensaver, Glance's night veil and the editor's preview all ask
 * `screenStateAt`, and each still shows what it showed before.
 */
import * as fs from 'fs';
import * as path from 'path';
import { renderHook } from '@testing-library/react';
import type { IdleBackground } from '@/lib/idleBackground';
import type { ScreenState } from '@/lib/throughTheDay';

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
  localStorage.setItem('prism-screensaver-dim', '0.5');
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

describe('the wall', () => {
  it('asks screenStateAt with idle, Away, Sitter, the time and the dim', () => {
    jest.setSystemTime(NIGHT);
    const { result } = renderHook(() => useWallScene({ idle: true, away: false, sitter: false, background: bg }));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      idle: true, away: false, sitter: false, background: bg, dimLevel: 0.5,
      at: { now: NIGHT, lat: 45, lon: -100 },
    }));
    expect(result.current).toMatchObject({ state: 'night', night: true, look: 'off', dim: 0.5 });
  });

  it('keeps the dim off in Away, as before', () => {
    jest.setSystemTime(NIGHT);
    const { result } = renderHook(() => useWallScene({ idle: true, away: true, sitter: false, background: bg }));
    expect(result.current).toMatchObject({ state: 'active', night: true, dim: 0 });
  });
});

describe('Glance and the editor preview', () => {
  // The Dashboard before #1344, as it read: the veil, the backdrop, the dim
  // and whether Glance's parts fade.
  function before(previewState: ScreenState | null, calmIdle: boolean, nightNow: boolean) {
    const sceneNight = previewState === 'night' || (previewState !== 'resting' && nightNow);
    const backdrop = previewState === null ? null : previewState === 'active' ? 'dashboard'
      : previewState === 'night' ? bg.night : bg.day;
    const dim = previewState === 'night' && backdrop === 'dashboard' ? 0.5 : 0;
    const idle = calmIdle || previewState === 'resting' || previewState === 'night';
    return { sceneNight, backdrop, dim, idle };
  }

  it.each([null, 'active', 'resting', 'night'] as const)('shows what it showed before with the preview at %s', (previewState) => {
    for (const calmIdle of previewState === null ? [false, true] : [false]) {
      for (const now of [DAY, NIGHT]) {
        jest.setSystemTime(now);
        spy.mockClear();
        const { result, unmount } = renderHook(() => usePreviewScene({ previewState, calmIdle, background: bg }));
        expect(spy).toHaveBeenCalled();
        const scene = result.current;
        const was = before(previewState, calmIdle, now === NIGHT);
        expect(scene.night).toBe(was.sceneNight);
        expect(scene.state !== 'active').toBe(was.idle);
        if (previewState) {
          expect(scene.look).toBe(was.backdrop);
          expect(previewState === 'night' && scene.look === 'dashboard' ? scene.dim : 0).toBe(was.dim);
        }
        unmount();
      }
    }
  });

  it('gives the night outright for the Resting and Night previews', () => {
    jest.setSystemTime(DAY);
    renderHook(() => usePreviewScene({ previewState: 'night', calmIdle: false, background: bg }));
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ idle: true, at: { night: true } }));
    renderHook(() => usePreviewScene({ previewState: 'resting', calmIdle: false, background: bg }));
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ idle: true, at: { night: false } }));
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

  it('the dashboard takes Glance\'s veil and the preview from usePreviewScene', () => {
    const s = src('dashboard/Dashboard.tsx');
    expect(s).toMatch(/usePreviewScene\(/);
    expect(s).toMatch(/night: sceneNight/);
    expect(s).not.toMatch(ownRules);
  });
});
