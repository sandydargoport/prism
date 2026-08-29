/**
 * Google Tasks must read credentials from the same place everything else does.
 *
 * Three call sites in the Tasks path read process.env.GOOGLE_CLIENT_ID
 * directly while Calendar, Gmail, oauth-status and the paste-a-token flow all
 * went through getGoogleCredentials(). On an install configured through the
 * app rather than the environment that meant:
 *
 *   - Connect dead-ended: no env var, so it redirected to a setup wizard that
 *     no longer offers Google once setup is complete
 *   - and worse, token refresh returned null, so sync worked for about an hour
 *     and then stopped for good
 *
 * The second is why this is tested rather than just fixed: it is invisible
 * until an access token expires.
 */
const mockGetCreds = jest.fn();
jest.mock('@/lib/integrations/credentialStore', () => ({
  getGoogleCredentials: (...a: unknown[]) => mockGetCreds(...a),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

import googleTasksProvider from '../google-tasks';

const ENV_KEYS = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  jest.clearAllMocks();
  // The environment is deliberately empty: this is the configuration that used
  // to fail, and the one every in-app configured install actually has.
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  mockGetCreds.mockResolvedValue({
    clientId: 'db-client-id',
    clientSecret: 'db-client-secret',
    redirectUri: '',
    gmailRedirectUri: '',
  });
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ access_token: 'fresh', expires_in: 3600 }),
  });
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('googleTasksProvider.refreshTokens', () => {
  it('refreshes using database credentials when the environment has none', async () => {
    const result = await googleTasksProvider.refreshTokens!({
      accessToken: 'old',
      refreshToken: 'rt',
    });

    expect(result).not.toBeNull();
    expect(result?.accessToken).toBe('fresh');
    expect(mockGetCreds).toHaveBeenCalled();
  });

  it('sends the stored client pair to Google, not an empty one', async () => {
    await googleTasksProvider.refreshTokens!({ accessToken: 'old', refreshToken: 'rt' });

    const body = String(mockFetch.mock.calls[0][1].body);
    expect(body).toContain('client_id=db-client-id');
    expect(body).toContain('client_secret=db-client-secret');
  });

  it('still returns null when nothing is configured anywhere', async () => {
    mockGetCreds.mockResolvedValue(null);
    const result = await googleTasksProvider.refreshTokens!({
      accessToken: 'old',
      refreshToken: 'rt',
    });
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not call Google without a refresh token', async () => {
    const result = await googleTasksProvider.refreshTokens!({ accessToken: 'old' });
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
