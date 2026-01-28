/**
 * ============================================================================
 * PRISM - Current User API Route
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Returns the currently authenticated user's information.
 * This is useful for:
 * - Verifying if a user is logged in
 * - Getting user info on page load
 * - Refreshing user data after updates
 *
 * ENDPOINT: GET /api/auth/me
 *
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/auth/session';


/**
 * GET /api/auth/me
 * ============================================================================
 * Returns the currently logged-in user.
 *
 * AUTHENTICATION:
 * Checks the prism_session and prism_user cookies to determine
 * if a user is logged in.
 *
 * RESPONSE:
 * - 200: User is authenticated
 *   {
 *     authenticated: true,
 *     user: { id, name, role, color, avatarUrl, email, preferences }
 *   }
 * - 401: Not authenticated
 *   {
 *     authenticated: false,
 *     user: null
 *   }
 *
 * NOTE:
 * Session tokens are validated against Redis to ensure they are:
 * 1. Valid and not expired
 * 2. Associated with an existing user
 * 3. Not invalidated by logout
 * ============================================================================
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    // Get session cookies
    const sessionToken = cookieStore.get('prism_session')?.value;
    const userId = cookieStore.get('prism_user')?.value;

    // No session = not authenticated
    if (!sessionToken || !userId) {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    // Validate session token against Redis
    const sessionData = await validateSession(sessionToken);

    if (!sessionData) {
      // Session is invalid or expired - clear cookies
      cookieStore.set('prism_session', '', { maxAge: 0, path: '/' });
      cookieStore.set('prism_user', '', { maxAge: 0, path: '/' });

      return NextResponse.json(
        {
          authenticated: false,
          user: null,
          error: 'Session expired',
        },
        { status: 401 }
      );
    }

    // Verify userId from cookie matches the session
    if (sessionData.userId !== userId) {
      // Mismatch between cookie and session - clear cookies
      cookieStore.set('prism_session', '', { maxAge: 0, path: '/' });
      cookieStore.set('prism_user', '', { maxAge: 0, path: '/' });

      return NextResponse.json(
        {
          authenticated: false,
          user: null,
          error: 'Invalid session',
        },
        { status: 401 }
      );
    }

    // Fetch user from database
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        color: users.color,
        avatarUrl: users.avatarUrl,
        email: users.email,
        preferences: users.preferences,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      // User no longer exists - clear invalid session
      cookieStore.set('prism_session', '', { maxAge: 0, path: '/' });
      cookieStore.set('prism_user', '', { maxAge: 0, path: '/' });

      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        color: user.color,
        avatarUrl: user.avatarUrl,
        email: user.email,
        preferences: user.preferences,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching current user:', error);

    return NextResponse.json({
      authenticated: false,
      user: null,
      error: 'Failed to verify authentication',
    });
  }
}
