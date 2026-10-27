/**
 * A screen's identity cookie (#690): a browser can only ever read back the id
 * the server signed for it, never another screen's, and a trusted-device
 * token is not a display token.
 */
import { issueDisplayToken, readDisplayToken, cleanDisplayName, isOnline } from '../displayIdentity';
import { issueTrustedDeviceToken } from '../authWall';

const KITCHEN = '22222222-2222-4222-8222-222222222222';
const HALL = '33333333-3333-4333-8333-333333333333';

describe('display token', () => {
  const ORIGINAL = process.env.SESSION_SECRET;
  beforeEach(() => {
    process.env.SESSION_SECRET = 'test_secret_for_display_tokens';
  });
  afterAll(() => {
    process.env.SESSION_SECRET = ORIGINAL;
  });

  it('reads back the id it was issued for', () => {
    expect(readDisplayToken(issueDisplayToken(KITCHEN))).toBe(KITCHEN);
  });

  it('refuses one screen\'s signature on another screen\'s id', () => {
    const hallMac = issueDisplayToken(HALL).split('.')[2];
    expect(readDisplayToken(`d1.${KITCHEN}.${hallMac}`)).toBeNull();
  });

  it('refuses a token signed with another secret', () => {
    const token = issueDisplayToken(KITCHEN);
    process.env.SESSION_SECRET = 'a_completely_different_secret_value';
    expect(readDisplayToken(token)).toBeNull();
  });

  it('refuses malformed tokens and a trusted-device token', () => {
    for (const t of ['', 'nonsense', `d1.${KITCHEN}`, `d1.not-an-id.${'a'.repeat(64)}`, `d2.${KITCHEN}.aa`]) {
      expect(readDisplayToken(t)).toBeNull();
    }
    expect(readDisplayToken(undefined)).toBeNull();
    expect(readDisplayToken(issueTrustedDeviceToken())).toBeNull();
  });
});

describe('cleanDisplayName', () => {
  it('trims and collapses spaces, and refuses empty or over-long names', () => {
    expect(cleanDisplayName('  Upstairs   hall ')).toBe('Upstairs hall');
    expect(cleanDisplayName('x'.repeat(60))).toHaveLength(60);
    expect(cleanDisplayName('x'.repeat(61))).toBeNull();
    expect(cleanDisplayName('   ')).toBeNull();
    expect(cleanDisplayName(null)).toBeNull();
  });
});

describe('isOnline', () => {
  it('is online within five minutes of the last heartbeat', () => {
    const now = Date.parse('2026-10-27T12:00:00Z');
    expect(isOnline(new Date(now - 4 * 60 * 1000), now)).toBe(true);
    expect(isOnline(new Date(now - 6 * 60 * 1000), now)).toBe(false);
    expect(isOnline(null, now)).toBe(false);
  });
});
