/**
 * @jest-environment jsdom
 */
/**
 * Signing the display out after a stretch of inactivity.
 *
 * A parent session lasts 7 days, its window is refreshed on every request, and
 * the dashboard polls constantly — so a wall display stays authenticated as
 * whoever last signed in until the 30-day cap, and anyone who walks up inherits
 * it. This bounds that to actual presence.
 */
import { shouldLogOut, getIdleLogoutMinutes, DEFAULT_IDLE_LOGOUT_MINUTES } from '../useIdleLogout';

const MIN = 60 * 1000;
const NOW = 1_000_000_000;

beforeEach(() => window.localStorage.clear());

describe('shouldLogOut', () => {
  it('signs out once the display has been idle past the setting', () => {
    expect(shouldLogOut(30, NOW - 31 * MIN, NOW)).toBe(true);
  });

  it('leaves an active session alone', () => {
    expect(shouldLogOut(30, NOW - 29 * MIN, NOW)).toBe(false);
  });

  it('does not fire exactly on the boundary, so a rounding wobble cannot', () => {
    expect(shouldLogOut(30, NOW - 30 * MIN, NOW)).toBe(false);
  });

  it('never signs out when set to Never', () => {
    expect(shouldLogOut(0, NOW - 24 * 60 * MIN, NOW)).toBe(false);
  });

  it('treats a negative setting as Never rather than as immediate', () => {
    // A corrupted value must not lock someone out of their own display.
    expect(shouldLogOut(-5, NOW - 24 * 60 * MIN, NOW)).toBe(false);
  });
});

describe('getIdleLogoutMinutes', () => {
  it('defaults to 30 minutes when nothing is stored', () => {
    expect(getIdleLogoutMinutes()).toBe(DEFAULT_IDLE_LOGOUT_MINUTES);
  });

  it('reads a stored value', () => {
    window.localStorage.setItem('prism-idle-logout-minutes', '15');
    expect(getIdleLogoutMinutes()).toBe(15);
  });

  it('reads a stored Never', () => {
    window.localStorage.setItem('prism-idle-logout-minutes', '0');
    expect(getIdleLogoutMinutes()).toBe(0);
  });

  it('falls back to the default on a nonsense value', () => {
    window.localStorage.setItem('prism-idle-logout-minutes', 'soon');
    expect(getIdleLogoutMinutes()).toBe(DEFAULT_IDLE_LOGOUT_MINUTES);
  });

  it('falls back rather than accepting a negative', () => {
    window.localStorage.setItem('prism-idle-logout-minutes', '-1');
    expect(getIdleLogoutMinutes()).toBe(DEFAULT_IDLE_LOGOUT_MINUTES);
  });

  it('survives storage throwing', () => {
    const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(getIdleLogoutMinutes()).toBe(DEFAULT_IDLE_LOGOUT_MINUTES);
    spy.mockRestore();
  });
});
