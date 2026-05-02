import { NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import type { RolePermissions } from '@/types/user';

export interface AuthResult {
  userId: string;
  role: 'parent' | 'child' | 'guest';
  /** API token scopes, if authenticated via bearer token. Undefined for session auth. */
  scopes?: string[];
}

interface WithAuthOptions {
  /** Required permission (checked via requireRole for session auth; checked against token scopes for API tokens) */
  permission?: keyof RolePermissions;
  /**
   * Required token scope. When set, the request MUST be authenticated via an
   * API token whose scopes include either `*` or the named scope. Session
   * cookies are rejected. Use this for endpoints that are intentionally
   * machine-to-machine only (e.g. the Voice API).
   */
  tokenScope?: string;
  /** Rate limit configuration */
  rateLimit?: {
    /** Feature name for rate limit key */
    feature: string;
    /** Max requests per window */
    limit: number;
    /** Window size in seconds */
    windowSeconds: number;
  };
}

/**
 * Check whether a token's scopes allow a given permission.
 * ['*'] grants everything; otherwise the permission must be listed explicitly.
 */
function tokenHasScope(scopes: string[], permission: string): boolean {
  return scopes.includes('*') || scopes.includes(permission);
}

/**
 * Wraps an API handler with authentication, permission, and rate limit checks.
 * Reduces boilerplate in mutation routes.
 *
 * @example
 * export async function POST(request: NextRequest) {
 *   return withAuth(async (auth) => {
 *     // Your handler logic here
 *     return NextResponse.json({ success: true });
 *   }, {
 *     permission: 'canManageChores',
 *     rateLimit: { feature: 'chores', limit: 30, windowSeconds: 60 }
 *   });
 * }
 */
export async function withAuth<T>(
  handler: (auth: AuthResult) => Promise<T>,
  options?: WithAuthOptions
): Promise<T | NextResponse> {
  // Check authentication
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  // Check required token scope (rejects session-cookie callers)
  if (options?.tokenScope) {
    if (auth.scopes === undefined) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'API token required for this endpoint' } },
        { status: 401 }
      );
    }
    if (!tokenHasScope(auth.scopes, options.tokenScope)) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: `Token scope must include '${options.tokenScope}' or '*'` } },
        { status: 403 }
      );
    }
  }

  // Check permission if specified
  if (options?.permission) {
    // For API tokens: check scope instead of RBAC (tokens have explicit scope list)
    if (auth.scopes !== undefined) {
      if (!tokenHasScope(auth.scopes, options.permission)) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Token scope does not permit this action' } },
          { status: 403 }
        );
      }
    } else {
      const forbidden = requireRole(auth, options.permission);
      if (forbidden) return forbidden;
    }
  }

  // Check rate limit if specified
  if (options?.rateLimit) {
    const { rateLimitGuard } = await import('@/lib/cache/rateLimit');
    const limited = await rateLimitGuard(
      auth.userId,
      options.rateLimit.feature,
      options.rateLimit.limit,
      options.rateLimit.windowSeconds
    );
    if (limited) return limited;
  }

  return handler(auth);
}
