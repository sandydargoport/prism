/**
 * The Microsoft OAuth callbacks log the provider's error from the redirect's
 * query string. That text is the caller's, so it is logged on one line and
 * never as console's format string: it cannot forge or split log lines.
 */
jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn().mockResolvedValue({ userId: 'u1', role: 'parent' }),
  requireRole: jest.fn().mockReturnValue(null),
}));
jest.mock('@/lib/auth/oauthState', () => ({
  consumeOAuthState: jest.fn().mockResolvedValue({ status: 'ok', payload: {} }),
}));
jest.mock('@/lib/cache/getRedisClient', () => ({ getRedisClient: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/db/client', () => ({ db: {} }));

import { GET as photos } from '../route';
import { GET as tasks } from '../../../microsoft-tasks/callback/route';

describe('Microsoft OAuth error lines', () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  afterEach(() => spy.mockClear());
  afterAll(() => spy.mockRestore());

  it.each([['photos', photos], ['tasks', tasks]] as const)('%s: the provider error is one line, as a %%s argument', async (_name, GET) => {
    const forged = encodeURIComponent('denied\n2026-01-01 ERROR forged line %o');
    const res = await GET(new Request(`http://localhost/cb?error=access_denied&error_description=${forged}&state=s`));
    expect(res.status).toBeGreaterThanOrEqual(300);
    const call = spy.mock.calls.find((c) => String(c[1] ?? c[0]).includes('OAuth error'))!;
    expect(call).toBeDefined();
    expect(call[0]).toBe('%s');
    expect(call[1]).not.toMatch(/[\r\n]/);
    expect(call[1]).toContain('denied 2026-01-01 ERROR forged line %o');
  });
});
