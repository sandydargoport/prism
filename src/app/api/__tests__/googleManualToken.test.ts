/**
 * @jest-environment node
 *
 * Security suite for POST /api/integrations/google/manual-token.
 * The load-bearing assertions: auth/role gating, error mapping, and that NO
 * response body or log line ever contains the pasted refresh token or client
 * secret on any exit path.
 */
import { NextRequest, NextResponse } from 'next/server';

const mockRequireAuth = jest.fn();
const mockRequireRole = jest.fn();
const mockGetCreds = jest.fn();
const mockRefresh = jest.fn();
const mockFetchEmail = jest.fn();
const mockStore = jest.fn();
const mockLogError = jest.fn();
const mockLogActivity = jest.fn();
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const valuesSpy = jest.fn((_v?: unknown) => Promise.resolve());

jest.mock('@/lib/auth', () => ({
  requireAuth: (...a: unknown[]) => mockRequireAuth(...a),
  requireRole: (...a: unknown[]) => mockRequireRole(...a),
}));
jest.mock('@/lib/db/client', () => ({
  db: {
    select: (...a: unknown[]) => mockSelect(...a),
    insert: (...a: unknown[]) => mockInsert(...a),
    update: (...a: unknown[]) => mockUpdate(...a),
  },
}));
jest.mock('@/lib/db/schema', () => ({ settings: { key: 'key', value: 'value' } }));
jest.mock('drizzle-orm', () => ({ eq: jest.fn() }));
jest.mock('@/lib/utils/crypto', () => ({ encrypt: (v: string) => `enc(${v})` }));
jest.mock('@/lib/utils/logError', () => ({ logError: (...a: unknown[]) => mockLogError(...a) }));
jest.mock('@/lib/services/auditLog', () => ({ logActivity: (...a: unknown[]) => mockLogActivity(...a) }));
jest.mock('@/lib/integrations/credentialStore', () => ({
  getGoogleCredentials: (...a: unknown[]) => mockGetCreds(...a),
}));
jest.mock('@/lib/integrations/oauth-userinfo', () => ({
  fetchGoogleAccountEmail: (...a: unknown[]) => mockFetchEmail(...a),
}));
jest.mock('@/lib/integrations/googleCalendarStore', () => ({
  storeGoogleCalendarConnection: (...a: unknown[]) => mockStore(...a),
}));
jest.mock('@/lib/integrations/google-calendar', () => {
  class TokenRevokedError extends Error {}
  return {
    __esModule: true,
    TokenRevokedError,
    refreshAccessToken: (...a: unknown[]) => mockRefresh(...a),
  };
});

import { POST } from '../integrations/google/manual-token/route';
import { TokenRevokedError } from '@/lib/integrations/google-calendar';

const CLIENT_ID = '123-abc.apps.googleusercontent.com';
const SECRET = 'GOCSPX-supersecret_value';
const TOKEN = '1//0gSuperSecretRefreshToken';
const goodBody = { clientId: CLIENT_ID, clientSecret: SECRET, refreshToken: TOKEN };

function req(body: object) {
  return new NextRequest('http://localhost/api/integrations/google/manual-token', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

/** No response body and no log argument may ever contain the secret or token. */
function expectNoLeak(bodyText: string) {
  expect(bodyText).not.toContain(SECRET);
  expect(bodyText).not.toContain(TOKEN);
  const logged = mockLogError.mock.calls.flat().map(String).join(' ');
  expect(logged).not.toContain(SECRET);
  expect(logged).not.toContain(TOKEN);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ userId: 'p1', role: 'parent' });
  mockRequireRole.mockReturnValue(undefined);
  mockGetCreds.mockResolvedValue(null);
  mockRefresh.mockResolvedValue({
    access_token: 'at_plain',
    expires_in: 3600,
    scope: 'https://www.googleapis.com/auth/calendar openid email',
    token_type: 'Bearer',
  });
  mockFetchEmail.mockResolvedValue('user@example.com');
  mockStore.mockResolvedValue({
    calendarCount: 2,
    inserted: 2,
    updated: 0,
    skippedDismissed: 0,
    accountEmail: 'user@example.com',
  });
  mockSelect.mockReturnValue({ from: () => ({ where: () => [] }) });
  mockInsert.mockReturnValue({ values: valuesSpy });
  mockUpdate.mockReturnValue({ set: () => ({ where: () => Promise.resolve() }) });
});

describe('POST /api/integrations/google/manual-token — auth', () => {
  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(NextResponse.json({ error: 'unauth' }, { status: 401 }));
    const res = await POST(req(goodBody));
    expect(res.status).toBe(401);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('returns 403 for a role without canModifySettings', async () => {
    mockRequireRole.mockReturnValue(NextResponse.json({ error: 'forbidden' }, { status: 403 }));
    const res = await POST(req(goodBody));
    expect(res.status).toBe(403);
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

describe('POST /api/integrations/google/manual-token — validation & mapping', () => {
  it('400 invalid_input on a malformed client id (never echoes the value)', async () => {
    const res = await POST(req({ ...goodBody, clientId: 'nope' }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe('invalid_input');
    expectNoLeak(JSON.stringify(body));
  });

  it('409 when a different client is already configured and no overwrite', async () => {
    mockGetCreds.mockResolvedValue({ clientId: 'other.apps.googleusercontent.com', clientSecret: 'x', redirectUri: '', gmailRedirectUri: '' });
    const res = await POST(req(goodBody));
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.error).toBe('client_mismatch_confirm_required');
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('proceeds when overwriteCredentials confirms the replacement', async () => {
    mockGetCreds.mockResolvedValue({ clientId: 'other.apps.googleusercontent.com', clientSecret: 'x', redirectUri: '', gmailRedirectUri: '' });
    const res = await POST(req({ ...goodBody, overwriteCredentials: true }));
    expect(res.status).toBe(200);
  });

  it('400 invalid_grant when the token is revoked/expired', async () => {
    mockRefresh.mockRejectedValue(new TokenRevokedError('invalid_grant'));
    const res = await POST(req(goodBody));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe('invalid_grant');
    expectNoLeak(JSON.stringify(body));
  });

  it('400 invalid_client when the id/secret pair is rejected', async () => {
    mockRefresh.mockRejectedValue(new Error('400 invalid_client: bad'));
    const res = await POST(req(goodBody));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe('invalid_client');
  });

  // The route no longer requires Calendar specifically: a token is accepted if
  // it covers ANY supported capability (Calendar, Tasks or Gmail), so the
  // failure case is now "covers none of them". See #310.
  it('400 no_supported_scope when the token covers none of the supported APIs', async () => {
    mockRefresh.mockResolvedValue({ access_token: 'at', expires_in: 3600, scope: 'openid email', token_type: 'Bearer' });
    const res = await POST(req(goodBody));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe('no_supported_scope');
    expect(mockStore).not.toHaveBeenCalled();
  });
});

describe('POST /api/integrations/google/manual-token — success', () => {
  it('200, stores the pasted refresh token, encrypts creds, audits counts only', async () => {
    const res = await POST(req(goodBody));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      capabilities: ['calendar'],
      enabled: 'Calendar',
      needsTaskListSelection: false,
      calendarCount: 2,
      accountEmail: 'user@example.com',
    });
    expectNoLeak(JSON.stringify(body));

    // Exactly one refresh + one store.
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockStore).toHaveBeenCalledTimes(1);

    // The PASTED refresh token is what gets stored.
    expect(mockStore.mock.calls[0][0].tokens.refreshToken).toBe(TOKEN);

    // Client creds persisted encrypted — never in plaintext.
    const stored = valuesSpy.mock.calls[0]?.[0] as { value: { clientId: string; clientSecret: string } };
    // encrypt() is applied to both (the real impl is AES-GCM; the mock echoes
    // inside enc(…), so we assert the wrapper was called rather than absence of
    // the plaintext — real ciphertext never contains it).
    expect(stored.value.clientSecret).toBe(`enc(${SECRET})`);
    expect(stored.value.clientId).toBe(`enc(${CLIENT_ID})`);

    // Audit summary carries a count, not credentials.
    const summary = mockLogActivity.mock.calls[0][0].summary as string;
    expect(summary).toContain('2 calendars');
    expect(summary).not.toContain(TOKEN);
  });

  it('persists client creds BEFORE storing calendar rows (bound-client ordering)', async () => {
    const order: string[] = [];
    valuesSpy.mockImplementation(() => {
      order.push('creds');
      return Promise.resolve();
    });
    mockStore.mockImplementation(() => {
      order.push('store');
      return Promise.resolve({ calendarCount: 1, inserted: 1, updated: 0, skippedDismissed: 0, accountEmail: null });
    });
    await POST(req(goodBody));
    expect(order).toEqual(['creds', 'store']);
  });
});
