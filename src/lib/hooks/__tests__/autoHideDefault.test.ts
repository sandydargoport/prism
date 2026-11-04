import { autoHideEnabledFor } from '../useAutoHideUI';

// #808: on a new install with the scenery look, a screen that never chose
// hides the rail and bar when idle. A screen's own choice always wins, and
// existing installs (no household default) keep the old default, off.

describe('autoHideEnabledFor', () => {
  it("follows the household on a screen that never chose", () => {
    expect(autoHideEnabledFor(null, true)).toBe(true);
    expect(autoHideEnabledFor(null, false)).toBe(false);
  });

  it("keeps a screen's own choice either way", () => {
    expect(autoHideEnabledFor('false', true)).toBe(false);
    expect(autoHideEnabledFor('true', false)).toBe(true);
  });
});
