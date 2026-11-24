/**
 * The form for another screen's settings writes what that screen's own
 * controls would have written (#690).
 */
import { KEYBOARD_DEVICE_PREFS } from '@/lib/input/keyboardDevicePref';
import { DEFAULT_IDLE_LOGOUT_MINUTES, IDLE_LOGOUT_KEY, IDLE_LOGOUT_OPTIONS } from '@/lib/hooks/idleLogoutOptions';
import { SCREEN_SETTING_KEYS } from '../screenSettings';
import { changesFor, currentOption, SCREEN_SETTING_FIELDS } from '../screenSettingFields';

const field = (key: string) => SCREEN_SETTING_FIELDS.find((f) => f.key === key)!;

describe('SCREEN_SETTING_FIELDS', () => {
  it('is the screen\'s options under Look > This screen, and no others', () => {
    // The screensaver's own settings are edited in its panel and on the Screen
    // sheet (see screenSettingsInEditor.test.tsx), not from this table.
    expect(SCREEN_SETTING_FIELDS.map((f) => f.key).sort()).toEqual([
      'prism-idle-logout-minutes', 'prism-orientation-override', 'prism-perf-mode',
      'prism:auto-hide-ui', 'prism:keyboard-on-this-device',
    ]);
    for (const f of SCREEN_SETTING_FIELDS) expect(SCREEN_SETTING_KEYS).toContain(f.key);
  });

  it('falls back to one of its own options, and has no option twice', () => {
    for (const f of SCREEN_SETTING_FIELDS) {
      const raws = f.options.map((o) => o.raw);
      expect(raws).toContain(f.fallback);
      expect(new Set(raws).size).toBe(raws.length);
    }
  });

  it('stores the keyboard choice as JSON, as the screen does', () => {
    expect(field('prism:keyboard-on-this-device').options.map((o) => o.raw))
      .toEqual(KEYBOARD_DEVICE_PREFS.map((p) => JSON.stringify(p)));
    expect(currentOption(field('prism:keyboard-on-this-device'), { 'prism:keyboard-on-this-device': 'never' }))
      .toBe('"household"');
  });
});

// #1159: the sign-out timer left Settings > Appearance for the screen's Look sheet.
describe('Sign out after', () => {
  it('is one of the screen\'s own options, with the choices and default it had in Settings', () => {
    const f = field(IDLE_LOGOUT_KEY);
    expect(f).toBeDefined();
    expect(f.options.map((o) => o.raw)).toEqual(IDLE_LOGOUT_OPTIONS.map((o) => String(o.value)));
    expect(currentOption(f, {})).toBe(String(DEFAULT_IDLE_LOGOUT_MINUTES));
    expect(currentOption(f, { [IDLE_LOGOUT_KEY]: '240' })).toBe('240');
  });
});

describe('currentOption', () => {
  it('shows what the screen falls back to when nothing, or nothing it knows, is stored', () => {
    expect(currentOption(field('prism-orientation-override'), {})).toBe('auto');
    expect(currentOption(field('prism-orientation-override'), { 'prism-orientation-override': 'portrait' })).toBe('portrait');
    expect(currentOption(field('prism:auto-hide-ui'), { 'prism:auto-hide-ui': 'yes' })).toBe('false');
  });

  it('reads an old performance value as the screen does', () => {
    expect(currentOption(field('prism-perf-mode'), { 'prism-perf-mode': 'true' })).toBe('reduced');
    expect(currentOption(field('prism-perf-mode'), { 'prism-perf-mode': 'false' })).toBe('full');
  });
});

describe('changesFor', () => {
  it('writes the chosen raw string under the field\'s own key', () => {
    expect(changesFor(field('prism-perf-mode'), 'true')).toEqual({ 'prism-perf-mode': 'true' });
  });
});
