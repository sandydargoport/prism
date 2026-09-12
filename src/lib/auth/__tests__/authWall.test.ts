/**
 * The authentication wall's signing and gate logic (#339).
 *
 * The behaviour worth pinning down is the fail-open cases. A wall that locks a
 * household out of its own kitchen display because the database hiccuped is
 * worse than one that stays off, so "cannot tell" has to mean "off" — and a
 * forged trusted-device cookie has to mean "not trusted".
 */
import {
  issueTrustedDeviceToken,
  verifyTrustedDeviceToken,
  TRUSTED_DEVICE_COOKIE,
} from '../authWall';

describe('trusted-device token', () => {
  const ORIGINAL = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.SESSION_SECRET = 'test_secret_for_trusted_device_tokens';
  });

  afterAll(() => {
    process.env.SESSION_SECRET = ORIGINAL;
  });

  it('accepts a token it issued', () => {
    expect(verifyTrustedDeviceToken(issueTrustedDeviceToken())).toBe(true);
  });

  it('refuses a made-up token', () => {
    expect(verifyTrustedDeviceToken('v1.deadbeef')).toBe(false);
    expect(verifyTrustedDeviceToken('v1.')).toBe(false);
    expect(verifyTrustedDeviceToken('nonsense')).toBe(false);
    expect(verifyTrustedDeviceToken('')).toBe(false);
    expect(verifyTrustedDeviceToken(undefined)).toBe(false);
  });

  it('refuses a token signed with a different secret', () => {
    const token = issueTrustedDeviceToken();
    process.env.SESSION_SECRET = 'a_completely_different_secret_value';
    expect(verifyTrustedDeviceToken(token)).toBe(false);
  });

  // Rotating the session secret should drop every trusted device, which is the
  // whole point of rotating it.
  it('invalidates existing devices when the secret rotates', () => {
    const before = issueTrustedDeviceToken();
    process.env.SESSION_SECRET = 'rotated_secret_value_after_an_incident';
    expect(verifyTrustedDeviceToken(before)).toBe(false);
    expect(verifyTrustedDeviceToken(issueTrustedDeviceToken())).toBe(true);
  });

  it('does not throw when the payload is not hex', () => {
    expect(() => verifyTrustedDeviceToken('v1.zzzz')).not.toThrow();
    expect(verifyTrustedDeviceToken('v1.zzzz')).toBe(false);
  });

  it('names the cookie consistently', () => {
    expect(TRUSTED_DEVICE_COOKIE).toBe('prism_trusted_device');
  });
});
