import { NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import type { RolePermissions } from '@/types/user';

export interface AuthResult {
  userId: string;
  role: 'parent' | 'child' | 'guest';
}

interface WithAuthOptions {
  /** Required permission (checked via requireRole) */
  permission?: keyof RolePermissions;
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

  // Check permission if specified
  if (options?.permission) {
    const forbidden = requireRole(auth, options.permission);
    if (forbidden) return forbidden;
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
