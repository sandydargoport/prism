/**
 * What the editor's canvas draws (#1348): the darkness over it and the line
 * under it, both from the scene the wall reads.
 */
import { canvasCaption, canvasDarkness } from '../canvasScene';
import { screenStateAt } from '../throughTheDay';
import type { IdleSource } from '../idleBackground';

const RULE = { by: 'clock', from: '21:00', to: '06:30' } as const;
const sceneOf = (idle: boolean, night: boolean, look: IdleSource, dimLevel = 0.5) =>
  screenStateAt({ idle, background: { day: look, night: look, switch: RULE }, at: { night }, dimLevel });

describe('canvasDarkness', () => {
  it.each(['dashboard', 'photos', 'sky'] as const)('darkens %s at night, as the wall darkens every look', (look) => {
    expect(canvasDarkness(sceneOf(true, true, look))).toEqual({ kind: 'dim', opacity: 0.5 });
  });

  it('draws a screen set to go off as black', () => {
    expect(canvasDarkness(sceneOf(true, true, 'off'))).toEqual({ kind: 'off', opacity: 1 });
    expect(canvasDarkness(sceneOf(true, false, 'off'))).toEqual({ kind: 'off', opacity: 1 });
  });

  it('draws nothing in use, by day, or with no darker level', () => {
    expect(canvasDarkness(sceneOf(false, true, 'photos'))).toBeNull();
    expect(canvasDarkness(sceneOf(true, false, 'photos'))).toBeNull();
    expect(canvasDarkness(sceneOf(true, true, 'photos', 0))).toBeNull();
  });
});

describe('canvasCaption', () => {
  const caption = (idle: boolean, night: boolean, look: IdleSource, extra: { glance?: boolean; saved?: boolean; dimLevel?: number } = {}) =>
    canvasCaption({ name: 'Main', scene: sceneOf(idle, night, look, extra.dimLevel), width: 1280, height: 800, ...extra });

  it('names the dashboard, the state, what shows and the size', () => {
    expect(caption(true, true, 'photos')).toBe('Main, idle, at night: a photo frame, 50% darker. 1280 x 800.');
    expect(caption(true, false, 'photos')).toBe('Main, idle, by day: a photo frame. 1280 x 800.');
    expect(caption(true, true, 'sky', { dimLevel: 0.25 })).toBe('Main, idle, at night: the night sky, 25% darker. 1280 x 800.');
    expect(caption(true, false, 'dashboard')).toBe('Main, idle, by day: the dashboard, quieter. 1280 x 800.');
    expect(caption(true, true, 'off')).toBe('Main, idle, at night: screen off. 1280 x 800.');
    expect(caption(true, true, 'photos', { dimLevel: 0 })).toBe('Main, idle, at night: a photo frame. 1280 x 800.');
  });

  it('says how it looks in use, and Glance\'s night veil', () => {
    expect(caption(false, false, 'photos')).toBe('Main, in use, by day: the dashboard as someone using it sees it. 1280 x 800.');
    expect(caption(false, true, 'photos')).toBe('Main, in use, at night: the dashboard as someone using it sees it. 1280 x 800.');
    expect(caption(false, true, 'photos', { glance: true }))
      .toBe('Main, in use, at night: the dashboard as someone using it sees it, under its night veil. 1280 x 800.');
    expect(caption(false, false, 'photos', { saved: true })).toBe('Main, in use, by day: the dashboard as it is saved. 1280 x 800.');
  });

  it('leaves the size out until it is known', () => {
    expect(canvasCaption({ name: 'Main', scene: sceneOf(false, false, 'photos'), width: 0, height: 0 }))
      .toBe('Main, in use, by day: the dashboard as someone using it sees it.');
  });
});
