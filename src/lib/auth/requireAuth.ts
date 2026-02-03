import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { validateSession } from './session';
import { PERMISSIONS, type RolePermissions } from '@/types/user';

export interface AuthResult {
  userId: string;
  role: 'parent' | 'child' | 'guest';
}

/**
 * Validate the current request's session cookie.
 * Returns { userId, role } on success, or a 401 NextResponse on failure.
 */
export async function requireAuth(): Promise<AuthResult | NextResponse> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('prism_session')?.value;

  if (!sessionToken) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const session = await validateSession(sessionToken);
  if (!session) {
    return NextResponse.json(
      { error: 'Invalid or expired session' },
      { status: 401 }
    );
  }

  return { userId: session.userId, role: session.role };
}

/**
 * Server-side RBAC check. Returns a 403 response if the user lacks
 * the given permission, or null if the check passes.
 */
export function requireRole(
  auth: AuthResult,
  permission: keyof RolePermissions
): NextResponse | null {
  if (!PERMISSIONS[auth.role][permission]) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }
  return null;
}
