/**
 * Resolving a task source into a provider plus usable tokens.
 *
 * This is what lets the delete route reach the provider outside the periodic
 * sync. Every failure path must return a reason rather than throwing: the
 * caller deletes the task locally regardless, and an exception here would
 * take the user's delete down with it.
 */
const mockSelect = jest.fn();
const mockUpdateSet = jest.fn();
const mockGetProvider = jest.fn();
const mockRefreshTokens = jest.fn();

jest.mock('@/lib/db/client', () => ({
  db: {
    select: () => ({ from: () => ({ where: (...a: unknown[]) => mockSelect(...a) }) }),
    update: () => ({ set: (v: unknown) => { mockUpdateSet(v); return { where: () => Promise.resolve() }; } }),
  },
}));
jest.mock('@/lib/db/schema', () => ({ taskSources: { id: 'id' } }));
jest.mock('drizzle-orm', () => ({ eq: jest.fn() }));
jest.mock('@/lib/utils/crypto', () => ({
  decrypt: (v: string) => v.replace(/^enc\(|\)$/g, ''),
  encrypt: (v: string) => `enc(${v})`,
}));
jest.mock('@/lib/integrations/tasks', () => ({ getTaskProvider: (...a: unknown[]) => mockGetProvider(...a) }));

import { resolveTaskProviderAuth } from '../providerAuth';

const PAST = new Date(Date.now() - 60_000);
const FUTURE = new Date(Date.now() + 3_600_000);

function source(over: Record<string, unknown> = {}) {
  return {
    id: 's1',
    provider: 'google_tasks',
    externalListId: 'list-1',
    accessToken: 'enc(at)',
    refreshToken: 'enc(rt)',
    tokenExpiresAt: FUTURE,
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSelect.mockResolvedValue([source()]);
  mockGetProvider.mockReturnValue({ refreshTokens: (...a: unknown[]) => mockRefreshTokens(...a) });
});

describe('resolveTaskProviderAuth', () => {
  it('returns the provider, decrypted tokens and the list id', async () => {
    const res = await resolveTaskProviderAuth('s1');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.tokens.accessToken).toBe('at');
    expect(res.tokens.refreshToken).toBe('rt');
    expect(res.externalListId).toBe('list-1');
  });

  it('does not refresh a token that is still valid', async () => {
    await resolveTaskProviderAuth('s1');
    expect(mockRefreshTokens).not.toHaveBeenCalled();
  });

  it('refreshes an expired token and persists the rotated pair encrypted', async () => {
    mockSelect.mockResolvedValue([source({ tokenExpiresAt: PAST })]);
    mockRefreshTokens.mockResolvedValue({ accessToken: 'at2', refreshToken: 'rt2', expiresAt: FUTURE });

    const res = await resolveTaskProviderAuth('s1');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.tokens.accessToken).toBe('at2');
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'enc(at2)', refreshToken: 'enc(rt2)' }),
    );
  });

  it('reports rather than throws when the source is gone', async () => {
    mockSelect.mockResolvedValue([]);
    expect(await resolveTaskProviderAuth('s1')).toEqual({ ok: false, reason: 'no_source' });
  });

  it('reports rather than throws for an unknown provider', async () => {
    mockGetProvider.mockReturnValue(undefined);
    expect(await resolveTaskProviderAuth('s1')).toEqual({ ok: false, reason: 'unknown_provider' });
  });

  it('reports rather than throws when no token is stored', async () => {
    mockSelect.mockResolvedValue([source({ accessToken: null })]);
    expect(await resolveTaskProviderAuth('s1')).toEqual({ ok: false, reason: 'no_token' });
  });

  it('reports refresh_failed when the provider declines to refresh', async () => {
    mockSelect.mockResolvedValue([source({ tokenExpiresAt: PAST })]);
    mockRefreshTokens.mockResolvedValue(null);
    expect(await resolveTaskProviderAuth('s1')).toEqual({ ok: false, reason: 'refresh_failed' });
  });

  it('reports refresh_failed when expired with no refresh token to use', async () => {
    mockSelect.mockResolvedValue([source({ tokenExpiresAt: PAST, refreshToken: null })]);
    expect(await resolveTaskProviderAuth('s1')).toEqual({ ok: false, reason: 'refresh_failed' });
  });
});
