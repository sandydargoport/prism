/**
 * The form for another screen's settings writes what that screen's own
 * controls would have written (#690).
 */
import { KEYBOARD_DEVICE_PREFS } from '@/lib/input/keyboardDevicePref';
import { SCREEN_SETTING_KEYS } from '../screenSettings';
import { changesFor, currentOption, SCREEN_SETTING_FIELDS } from '../screenSettingFields';

const field = (key: string) => SCREEN_SETTING_FIELDS.find((f) => f.key === key)!;

describe('SCREEN_SETTING_FIELDS', () => {
  it('covers every synced setting a person chooses', () => {
    // The motion marker is written with the effect; nothing edits safe zones yet.
    const notOnTheForm = ['prism-screensaver-motion-v2', 'prism:screen-safe-zones'];
    expect(SCREEN_SETTING_FIELDS.map((f) => f.key).sort())
      .toEqual(SCREEN_SETTING_KEYS.filter((k) => !notOnTheForm.includes(k)).sort());
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

describe('currentOption', () => {
  it('shows what the screen falls back to when nothing, or nothing it knows, is stored', () => {
    expect(currentOption(field('prism-screensaver-timeout'), {})).toBe('120');
    expect(currentOption(field('prism-screensaver-drift'), { 'prism-screensaver-drift': 'off' })).toBe('off');
    expect(currentOption(field('prism-screensaver-shortcut'), { 'prism-screensaver-shortcut': 'yes' })).toBe('off');
  });

  it('asks for the dim hours only when the screen dims', () => {
    const hours = field('prism-screensaver-dim-hours');
    expect(hours.showIf!({})).toBe(false);
    expect(hours.showIf!({ 'prism-screensaver-dim': '0.5' })).toBe(true);
    expect(currentOption(hours, {})).toBe('22-7');
  });

  it('reads an effect stored under its old name as the screen does', () => {
    const motion = field('prism-screensaver-motion');
    expect(currentOption(motion, { 'prism-screensaver-motion': 'smoke' })).toBe('fade');
    expect(currentOption(motion, { 'prism-screensaver-motion': 'smoke', 'prism-screensaver-motion-v2': '1' }))
      .toBe('smoke');
  });
});

describe('changesFor', () => {
  it('marks an effect as named the current way, so Smoke stays Smoke', () => {
    expect(changesFor(field('prism-screensaver-motion'), 'smoke'))
      .toEqual({ 'prism-screensaver-motion': 'smoke', 'prism-screensaver-motion-v2': '1' });
    expect(changesFor(field('prism-perf-mode'), 'true')).toEqual({ 'prism-perf-mode': 'true' });
  });
});
