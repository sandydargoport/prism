/**
 * Which settings belong to a screen, and how changes to them merge (#690).
 */
import {
  cleanSettingChanges,
  diffSettings,
  mergeSettings,
  SCREEN_SETTING_KEYS,
  SCREEN_SETTING_MAX_LENGTH,
} from '../screenSettings';

describe('cleanSettingChanges', () => {
  it('accepts known keys with string or null values', () => {
    expect(cleanSettingChanges({ 'prism-screensaver-timeout': '300', 'prism-perf-mode': null }))
      .toEqual({ 'prism-screensaver-timeout': '300', 'prism-perf-mode': null });
    expect(cleanSettingChanges({})).toEqual({});
  });

  it('refuses the whole request if any key is not a screen setting', () => {
    // Theme stays per browser, and a household setting has no business here.
    expect(cleanSettingChanges({ 'prism-screensaver-timeout': '300', 'prism-theme': 'dark' })).toBeNull();
    expect(cleanSettingChanges({ 'prism-screensaver-layout': '[]' })).toBeNull();
  });

  it('refuses values that are not strings, or are too long, and bodies that are not objects', () => {
    expect(cleanSettingChanges({ 'prism-perf-mode': true })).toBeNull();
    expect(cleanSettingChanges({ 'prism-perf-mode': 'x'.repeat(SCREEN_SETTING_MAX_LENGTH + 1) })).toBeNull();
    expect(cleanSettingChanges(null)).toBeNull();
    expect(cleanSettingChanges(['prism-perf-mode'])).toBeNull();
  });
});

describe('mergeSettings and diffSettings', () => {
  it('sets, replaces and removes keys, and drops anything that is not a screen setting', () => {
    const merged = mergeSettings(
      { 'prism-perf-mode': 'true', 'prism-screensaver-drift': 'on', stray: 'x' } as never,
      { 'prism-perf-mode': null, 'prism-screensaver-drift': 'off', 'prism:auto-hide-ui': 'true' },
    );
    expect(merged).toEqual({ 'prism-screensaver-drift': 'off', 'prism:auto-hide-ui': 'true' });
  });

  it('lists every key whose value differs, with null for one that went away', () => {
    expect(diffSettings(
      { 'prism-perf-mode': 'true', 'prism-screensaver-drift': 'on' },
      { 'prism-screensaver-drift': 'on', 'prism-screensaver-timeout': '120' },
    )).toEqual({ 'prism-perf-mode': null, 'prism-screensaver-timeout': '120' });
  });

  it('covers the settings chosen for screens, and not theme', () => {
    expect(SCREEN_SETTING_KEYS).toEqual(expect.arrayContaining([
      'prism-screensaver-timeout', 'prism-screensaver-drift', 'prism-perf-mode',
      'prism:keyboard-on-this-device', 'prism-orientation-override', 'prism:screen-safe-zones', 'prism:auto-hide-ui',
    ]));
    expect(SCREEN_SETTING_KEYS).not.toContain('prism-theme');
  });
});
