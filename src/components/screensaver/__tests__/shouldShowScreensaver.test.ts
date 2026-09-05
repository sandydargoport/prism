/**
 * The screensaver yields to the two deliberate modes.
 *
 * Both put up a full-screen overlay and both are rendered BEFORE the
 * screensaver, so anything that lets it show while they are active means it
 * covers them — on a display nobody is touching, which is the whole point of
 * those modes.
 */
import { shouldShowScreensaver } from '../shouldShowScreensaver';

const state = (o: Partial<Parameters<typeof shouldShowScreensaver>[0]> = {}) => ({
  idle: false, away: false, babysitter: false, ...o,
});

describe('shouldShowScreensaver', () => {
  it('shows when the display is simply idle', () => {
    expect(shouldShowScreensaver(state({ idle: true }))).toBe(true);
  });

  it('does not show while Away mode is on', () => {
    expect(shouldShowScreensaver(state({ idle: true, away: true }))).toBe(false);
  });

  it('does not show while Babysitter mode is on', () => {
    expect(shouldShowScreensaver(state({ idle: true, babysitter: true }))).toBe(false);
  });

  it('does not show when both modes are on', () => {
    expect(shouldShowScreensaver(state({ idle: true, away: true, babysitter: true }))).toBe(false);
  });

  it('never shows before the display is idle, whatever the modes say', () => {
    for (const away of [false, true]) {
      for (const babysitter of [false, true]) {
        expect(shouldShowScreensaver(state({ idle: false, away, babysitter }))).toBe(false);
      }
    }
  });
});
