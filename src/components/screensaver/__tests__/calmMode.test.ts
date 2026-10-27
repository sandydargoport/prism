/**
 * Which widgets stay on a calm idle screen (#691).
 */
import { DEFAULT_IDLE_WIDGETS, calmIdleDrift, shownWhenIdle } from '../calmMode';

const widget = (i: string, showWhenIdle?: boolean) => ({ i, x: 0, y: 0, w: 4, h: 4, showWhenIdle });

describe('shownWhenIdle', () => {
  it('keeps the clock, weather and calendar by default', () => {
    expect([...DEFAULT_IDLE_WIDGETS].sort()).toEqual(['calendar', 'clock', 'weather']);
    for (const i of ['clock', 'weather', 'calendar']) expect(shownWhenIdle(widget(i))).toBe(true);
  });

  it('fades every other widget by default', () => {
    for (const i of ['tasks', 'chores', 'shopping', 'messages']) expect(shownWhenIdle(widget(i))).toBe(false);
  });

  it('follows the widget\'s own tick either way', () => {
    expect(shownWhenIdle(widget('tasks', true))).toBe(true);
    expect(shownWhenIdle(widget('clock', false))).toBe(false);
  });
});

describe('calmIdleDrift', () => {
  it('drifts in a figure eight on a display that has not chosen', () => {
    // The separate screensaver reads the same unset setting as still; a calm
    // screen holds the same board all night, which is what drift is for.
    expect(calmIdleDrift(null)).toBe('figure8');
  });

  it('follows the display\'s own choice, still included', () => {
    for (const d of ['off', 'breathe', 'ripple', 'figure8'] as const) expect(calmIdleDrift(d)).toBe(d);
  });
});
