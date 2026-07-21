import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { validateSession } from './session';
import { validateApiToken, type ApiTokenAuthResult } from './apiTokens';
import { PERMISSIONS, type RolePermissions } from '@/types/user';
import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export interface AuthResult {
  userId: string;
  role: 'parent' | 'child' | 'guest';
  /** Present only for API token auth. Undefined for session auth. */
  scopes?: string[];
}

/**
 * Extract and validate a Bearer token from the Authorization header.
 * Returns AuthResult on success, null if no bearer token or invalid.
 */
async function checkBearerToken(): Promise<AuthResult | null> {
  const headerStore = await headers();
  const authHeader = headerStore.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const rawToken = authHeader.slice(7);
  if (!rawToken) return null;

  const result: ApiTokenAuthResult | null = await validateApiToken(rawToken);
  if (!result) return null;
  // Propagate scopes so withAuth can enforce them
  return { userId: result.userId, role: result.role, scopes: result.scopes };
}

/**
 * Validate the current request's session cookie.
 * Returns { userId, role } on success, or a 401 NextResponse on failure.
 *
 * Checks Bearer token first, then falls back to cookie auth.
 */
export async function requireAuth(): Promise<AuthResult | NextResponse> {
  // 1. Check Bearer token (API tokens for machine-to-machine access)
  const bearerAuth = await checkBearerToken();
  if (bearerAuth) return bearerAuth;

  // 2. Fall back to cookie-based session auth
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('prism_session')?.value;

  if (!sessionToken) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const result = await validateSession(sessionToken);
  if (!result.ok) {
    if (result.reason === 'unavailable') {
      return NextResponse.json(
        { error: 'Service unavailable — session store unreachable' },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: 'Invalid or expired session' },
      { status: 401 }
    );
  }

  return { userId: result.session.userId, role: result.session.role };
}

/**
 * Optional authentication - returns user if logged in, null otherwise.
 * Use this for read-only endpoints that should work for guests.
 *
 * Checks Bearer token first, then falls back to cookie auth.
 */
export async function optionalAuth(): Promise<AuthResult | null> {
  // 1. Check Bearer token
  const bearerAuth = await checkBearerToken();
  if (bearerAuth) return bearerAuth;

  // 2. Fall back to cookie-based session auth
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('prism_session')?.value;

  if (!sessionToken) {
    return null;
  }

  const result = await validateSession(sessionToken);
  if (!result.ok) return null;

  return { userId: result.session.userId, role: result.session.role };
}

/**
 * Server-side RBAC check. Returns a 403 response if the user lacks
 * the given permission, or null if the check passes.
 *
 * API-token callers are authorized by their scope list, NOT by RBAC: every
 * token authenticates as role 'parent' (see validateApiToken), so an RBAC-only
 * check would let a narrowly scoped token (e.g. 'voice') pass every
 * parent-gated route. For token auth we require the token to carry '*' or the
 * named permission as a scope — matching withAuth()'s tokenHasScope semantics.
 */
export function requireRole(
  auth: AuthResult,
  permission: keyof RolePermissions
): NextResponse | null {
  if (auth.scopes !== undefined) {
    if (!auth.scopes.includes('*') && !auth.scopes.includes(permission)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }
    return null;
  }

  if (!PERMISSIONS[auth.role][permission]) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Tries optionalAuth() first; if no session, falls back to the
 * configured display user (read-only guest access for the family display).
 */
export async function getDisplayAuth(): Promise<AuthResult | null> {
  const auth = await optionalAuth();
  if (auth) return auth;

  try {
    const [setting] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'displayUserId'));

    if (!setting?.value) return null;

    const userId = setting.value as string;
    return { userId, role: 'guest' };
  } catch {
    return null;
  }
}
