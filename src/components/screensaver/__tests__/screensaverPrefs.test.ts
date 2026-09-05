/**
 * @jest-environment jsdom
 */
/**
 * An absent preference must not read as zero.
 *
 * `Number(localStorage.getItem(k))` is 0 when the key is missing, and 0 is
 * finite and not negative — so a guard of `isFinite(n) && n >= 0` accepts it.
 * The surface wobble defaulted to none and every waterline came out flat, with
 * nothing in the settings to explain why. Nothing threw and nothing logged.
 */
import { effectPrefs, PREF_KEYS } from '../screensaverPrefs';

const setAndNotify = (key: string, value: string | null) => {
  if (value === null) window.localStorage.removeItem(key);
  else window.localStorage.setItem(key, value);
  window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }));
};

beforeEach(() => window.localStorage.clear());

describe('effect preferences', () => {
  it('waves by default, with nothing stored', () => {
    setAndNotify(PREF_KEYS.WOBBLE_KEY, null);
    expect(effectPrefs().wobble).toBeGreaterThan(0);
  });

  it('honours a deliberate zero', () => {
    setAndNotify(PREF_KEYS.WOBBLE_KEY, '0');
    expect(effectPrefs().wobble).toBe(0);
  });

  it('honours a chosen amount', () => {
    setAndNotify(PREF_KEYS.WOBBLE_KEY, '1.8');
    expect(effectPrefs().wobble).toBe(1.8);
  });

  it('ignores a value that means nothing', () => {
    setAndNotify(PREF_KEYS.WOBBLE_KEY, 'lots');
    expect(effectPrefs().wobble).toBeGreaterThan(0);
  });

  it('carbonates by default and can be turned off', () => {
    setAndNotify(PREF_KEYS.CARBONATION_KEY, null);
    expect(effectPrefs().carbonation).toBe(true);
    setAndNotify(PREF_KEYS.CARBONATION_KEY, 'off');
    expect(effectPrefs().carbonation).toBe(false);
  });
});
