/**
 * Which widgets stay on a calm idle screen (#691).
 */
import { DEFAULT_IDLE_WIDGETS, shownWhenIdle } from '../calmMode';

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
