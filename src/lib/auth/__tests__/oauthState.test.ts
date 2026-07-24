/**
 * Tests for the OAuth state-nonce helpers (audit 2026-07 · M-OAUTH).
 *
 * createOAuthState persists a random nonce bound to the initiating user;
 * consumeOAuthState verifies it (single-use) and rejects missing / mismatched
 * nonces while allowing a degraded pass-through when Redis is down.
 */

const mockRedisClient = {
  setEx: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(1),
};
const mockGetRedisClient = jest.fn().mockResolvedValue(mockRedisClient);

jest.mock('@/lib/cache/getRedisClient', () => ({
  getRedisClient: () => mockGetRedisClient(),
}));

import { createOAuthState, consumeOAuthState, OAUTH_STATE_TTL } from '../oauthState';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetRedisClient.mockResolvedValue(mockRedisClient);
});

describe('createOAuthState', () => {
  it('returns a UUID nonce and stores it bound to the user + payload', async () => {
    const nonce = await createOAuthState('google', 'user-1', { returnSection: 'integrations' });

    expect(nonce).toMatch(UUID_RE);
    expect(mockRedisClient.setEx).toHaveBeenCalledWith(
      `google-oauth-state:${nonce}`,
      OAUTH_STATE_TTL,
      expect.any(String),
    );
    const stored = JSON.parse(mockRedisClient.setEx.mock.calls[0][2]);
    expect(stored).toEqual({ userId: 'user-1', returnSection: 'integrations' });
  });

  it('namespaces the key by provider', async () => {
    const nonce = await createOAuthState('microsoft', 'user-1', {});
    expect(mockRedisClient.setEx.mock.calls[0][0]).toBe(`microsoft-oauth-state:${nonce}`);
  });

  it('still returns a nonce when Redis is unavailable (degraded)', async () => {
    mockGetRedisClient.mockResolvedValue(null);
    const nonce = await createOAuthState('google', 'user-1', {});
    expect(nonce).toMatch(UUID_RE);
    expect(mockRedisClient.setEx).not.toHaveBeenCalled();
  });

  it('generates a distinct nonce each call', async () => {
    const a = await createOAuthState('google', 'u', {});
    const b = await createOAuthState('google', 'u', {});
    expect(a).not.toBe(b);
  });
});

describe('consumeOAuthState', () => {
  it('returns ok with the payload and deletes the key (single-use) on a valid match', async () => {
    mockRedisClient.get.mockResolvedValueOnce(
      JSON.stringify({ userId: 'user-1', returnSection: 'integrations' }),
    );

    const result = await consumeOAuthState('google', 'nonce-123', 'user-1');

    expect(result).toEqual({
      status: 'ok',
      payload: { userId: 'user-1', returnSection: 'integrations' },
    });
    expect(mockRedisClient.del).toHaveBeenCalledWith('google-oauth-state:nonce-123');
  });

  it('returns invalid when the nonce is not in Redis', async () => {
    mockRedisClient.get.mockResolvedValueOnce(null);
    const result = await consumeOAuthState('google', 'missing', 'user-1');
    expect(result).toEqual({ status: 'invalid' });
    expect(mockRedisClient.del).not.toHaveBeenCalled();
  });

  it('returns invalid and does NOT consume when the bound user differs', async () => {
    mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ userId: 'attacker' }));
    const result = await consumeOAuthState('google', 'nonce-123', 'victim');
    expect(result).toEqual({ status: 'invalid' });
    expect(mockRedisClient.del).not.toHaveBeenCalled();
  });

  it('returns invalid for a null/empty nonce', async () => {
    expect(await consumeOAuthState('google', null, 'user-1')).toEqual({ status: 'invalid' });
    expect(await consumeOAuthState('google', '', 'user-1')).toEqual({ status: 'invalid' });
  });

  it('returns invalid for malformed stored JSON', async () => {
    mockRedisClient.get.mockResolvedValueOnce('{not json');
    const result = await consumeOAuthState('google', 'nonce-123', 'user-1');
    expect(result).toEqual({ status: 'invalid' });
  });

  it('returns unavailable when Redis is down (degraded pass-through)', async () => {
    mockGetRedisClient.mockResolvedValue(null);
    const result = await consumeOAuthState('google', 'nonce-123', 'user-1');
    expect(result).toEqual({ status: 'unavailable' });
  });
});
