import { NextResponse } from 'next/server';
import { withAuth } from '../withAuth';
import type { AuthResult } from '../withAuth';

// --- Mocks ---

const mockRequireAuth = jest.fn<Promise<AuthResult | NextResponse>, []>();
const mockRequireRole = jest.fn<NextResponse | null, [AuthResult, string]>();
const mockRateLimitGuard = jest.fn<Promise<NextResponse | null>, [string, string, number, number]>();

jest.mock('@/lib/auth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...(args as [])),
  requireRole: (...args: unknown[]) => mockRequireRole(...(args as [AuthResult, string])),
}));

jest.mock('@/lib/cache/rateLimit', () => ({
  rateLimitGuard: (...args: unknown[]) => mockRateLimitGuard(...(args as [string, string, number, number])),
}));

// --- Helpers ---

const parentAuth: AuthResult = { userId: 'parent-1', role: 'parent' };
const childAuth: AuthResult = { userId: 'child-1', role: 'child' };

function json401() {
  return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
}

function json403() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function json429() {
  return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
}

// --- Tests ---

describe('withAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue(parentAuth);
    mockRequireRole.mockReturnValue(null);
    mockRateLimitGuard.mockResolvedValue(null);
  });

  it('passes auth result to handler when authenticated', async () => {
    const handler = jest.fn().mockResolvedValue(NextResponse.json({ ok: true }));

    await withAuth(handler);

    expect(handler).toHaveBeenCalledWith(parentAuth);
  });

  it('returns 401 when not authenticated', async () => {
    const unauthResponse = json401();
    mockRequireAuth.mockResolvedValue(unauthResponse);
    const handler = jest.fn();

    const result = await withAuth(handler);

    expect(result).toBe(unauthResponse);
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 403 when permission check fails', async () => {
    const forbiddenResponse = json403();
    mockRequireRole.mockReturnValue(forbiddenResponse);
    const handler = jest.fn();

    const result = await withAuth(handler, { permission: 'canModifySettings' });

    expect(result).toBe(forbiddenResponse);
    expect(mockRequireRole).toHaveBeenCalledWith(parentAuth, 'canModifySettings');
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 429 when rate limited', async () => {
    const limitedResponse = json429();
    mockRateLimitGuard.mockResolvedValue(limitedResponse);
    const handler = jest.fn();

    const result = await withAuth(handler, {
      rateLimit: { feature: 'test', limit: 10, windowSeconds: 60 },
    });

    expect(result).toBe(limitedResponse);
    expect(mockRateLimitGuard).toHaveBeenCalledWith('parent-1', 'test', 10, 60);
    expect(handler).not.toHaveBeenCalled();
  });

  it('skips permission check when no permission option given', async () => {
    const handler = jest.fn().mockResolvedValue(NextResponse.json({ ok: true }));

    await withAuth(handler);

    expect(mockRequireRole).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledWith(parentAuth);
  });

  it('skips rate limit check when no rateLimit option given', async () => {
    const handler = jest.fn().mockResolvedValue(NextResponse.json({ ok: true }));

    await withAuth(handler);

    expect(mockRateLimitGuard).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledWith(parentAuth);
  });

  it('works with child role when permission allows', async () => {
    mockRequireAuth.mockResolvedValue(childAuth);
    const handler = jest.fn().mockResolvedValue(NextResponse.json({ tasks: [] }));

    await withAuth(handler, { permission: 'canCompleteTasks' });

    expect(mockRequireRole).toHaveBeenCalledWith(childAuth, 'canCompleteTasks');
    expect(handler).toHaveBeenCalledWith(childAuth);
  });

  it('returns handler result on success', async () => {
    const expected = NextResponse.json({ data: 'test' });
    const handler = jest.fn().mockResolvedValue(expected);

    const result = await withAuth(handler);

    expect(result).toBe(expected);
  });

  describe('tokenScope', () => {
    it('rejects session-cookie auth with 401', async () => {
      // Session auth has no `scopes` field — that's how we detect it
      mockRequireAuth.mockResolvedValue(parentAuth);
      const handler = jest.fn();

      const result = await withAuth(handler, { tokenScope: 'voice' });

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(401);
      expect(handler).not.toHaveBeenCalled();
    });

    it('rejects API token without the required scope (403)', async () => {
      mockRequireAuth.mockResolvedValue({ ...parentAuth, scopes: ['other'] });
      const handler = jest.fn();

      const result = await withAuth(handler, { tokenScope: 'voice' });

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(403);
      expect(handler).not.toHaveBeenCalled();
    });

    it('accepts API token with the named scope', async () => {
      const tokenAuth: AuthResult = { ...parentAuth, scopes: ['voice'] };
      mockRequireAuth.mockResolvedValue(tokenAuth);
      const handler = jest.fn().mockResolvedValue(NextResponse.json({ ok: true }));

      await withAuth(handler, { tokenScope: 'voice' });

      expect(handler).toHaveBeenCalledWith(tokenAuth);
    });

    it('accepts API token with the wildcard scope', async () => {
      const tokenAuth: AuthResult = { ...parentAuth, scopes: ['*'] };
      mockRequireAuth.mockResolvedValue(tokenAuth);
      const handler = jest.fn().mockResolvedValue(NextResponse.json({ ok: true }));

      await withAuth(handler, { tokenScope: 'voice' });

      expect(handler).toHaveBeenCalledWith(tokenAuth);
    });
  });
});
