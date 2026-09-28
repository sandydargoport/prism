/**
 * The authentication wall in the proxy: who gets past it while it is on.
 *
 * API token callers (voice, Home Assistant, the MCP server) send a Bearer
 * header and no cookie, so the wall has to accept a valid token as well as a
 * session or a trusted device.
 */

import { NextRequest } from 'next/server';

jest.mock('@/lib/auth/authWall', () => ({
  isAuthWallEnabled: jest.fn(async () => true),
  verifyTrustedDeviceToken: jest.fn(() => false),
  TRUSTED_DEVICE_COOKIE: 'prism_trusted_device',
}));
jest.mock('@/lib/auth/session', () => ({
  validateSession: jest.fn(async () => ({ ok: false, reason: 'invalid' })),
}));
jest.mock('@/lib/auth/apiTokens', () => ({
  validateApiToken: jest.fn(),
}));

import { proxy } from '../proxy';
import { validateApiToken } from '@/lib/auth/apiTokens';
import { validateSession } from '@/lib/auth/session';

const mockValidateApiToken = validateApiToken as jest.MockedFunction<typeof validateApiToken>;
const mockValidateSession = validateSession as jest.MockedFunction<typeof validateSession>;

function get(path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, { headers: new Headers(headers) });
}

describe('proxy auth wall', () => {
  beforeEach(() => {
    mockValidateApiToken.mockReset();
    mockValidateSession.mockClear();
  });

  it('turns away an API caller with no credentials', async () => {
    const res = await proxy(get('/api/v1/voice/chores/today'));
    expect(res.status).toBe(401);
  });

  it('lets a valid API token through', async () => {
    mockValidateApiToken.mockResolvedValue({ userId: 'u1', role: 'parent', scopes: ['voice'] });
    const res = await proxy(get('/api/v1/voice/chores/today', { authorization: 'Bearer good-token' }));
    expect(res.status).toBe(200);
    expect(mockValidateApiToken).toHaveBeenCalledWith('good-token');
  });

  it('turns away an invalid API token without falling back to the cookie', async () => {
    mockValidateApiToken.mockResolvedValue(null);
    const res = await proxy(get('/api/v1/voice/chores/today', { authorization: 'Bearer bad-token' }));
    expect(res.status).toBe(401);
    expect(mockValidateSession).not.toHaveBeenCalled();
  });

  it('turns away an empty Bearer header', async () => {
    const res = await proxy(get('/api/tasks', { authorization: 'Bearer ' }));
    expect(res.status).toBe(401);
    expect(mockValidateApiToken).not.toHaveBeenCalled();
  });

  it('redirects a page request with an invalid token to sign in', async () => {
    mockValidateApiToken.mockResolvedValue(null);
    const res = await proxy(get('/calendar', { authorization: 'Bearer bad-token' }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('lets the caller through when the token store is unreachable, as for sessions', async () => {
    mockValidateApiToken.mockRejectedValue(new Error('db down'));
    const res = await proxy(get('/api/tasks', { authorization: 'Bearer any' }));
    expect(res.status).toBe(200);
  });

  it('still accepts a valid session cookie', async () => {
    mockValidateSession.mockResolvedValueOnce({ ok: true } as Awaited<ReturnType<typeof validateSession>>);
    const res = await proxy(get('/api/tasks', { cookie: 'prism_session=abc' }));
    expect(res.status).toBe(200);
  });
});
