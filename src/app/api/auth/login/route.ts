/**
 *
 * Handles PIN-based authentication for family members.
 * Verifies the user's PIN and creates a session.
 *
 * ENDPOINT: POST /api/auth/login
 *
 * HOW PIN AUTHENTICATION WORKS:
 * 1. User selects their avatar on the PIN pad
 * 2. User enters their 4-6 digit PIN
 * 3. PIN is sent to this endpoint
 * 4. We compare the PIN against the bcrypt hash in the database
 * 5. If valid, we create a session token stored in Redis
 * 6. Session token is stored in an httpOnly cookie
 *
 * SECURITY FEATURES:
 * - PINs are never stored in plain text (bcrypt hash)
 * - Redis-based rate limiting (works across instances)
 * - Session tokens validated against Redis store
 * - Session tokens are httpOnly cookies (not accessible to JS)
 * - Short session expiry for children
 * - Only guests can login without a PIN
 *
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import {
  createSession,
  isLoginLockedOut,
  recordFailedLogin,
  clearLoginAttempts,
} from '@/lib/auth/session';

// Determine if cookies should be secure based on BASE_URL scheme
const isSecure = process.env.BASE_URL?.startsWith('https://') ?? process.env.NODE_ENV === 'production';


/**
 * POST /api/auth/login
 * Authenticates a user with their PIN.
 *
 * REQUEST BODY:
 * {
 *   userId: string (required) - The user's ID
 *   pin: string (required for non-guests) - The 4-6 digit PIN
 * }
 *
 * RESPONSE:
 * - 200: Login successful
 *   {
 *     user: { id, name, role, color, avatarUrl },
 *     expiresAt: string (ISO timestamp)
 *   }
 * - 400: Invalid request
 * - 401: Invalid PIN
 * - 403: Account locked out / PIN required
 * - 404: User not found
 * - 500: Server error
 *
 * COOKIES SET:
 * - prism_session: Session token (httpOnly, secure in production)
 * - prism_user: User ID (for quick access, not httpOnly)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.userId || typeof body.userId !== 'string') {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Check if user is locked out (Redis-based rate limiting)
    const lockoutStatus = await isLoginLockedOut(body.userId);
    if (lockoutStatus.lockedOut) {
      return NextResponse.json(
        {
          error: 'Too many failed attempts. Please try again later.',
          lockedOut: true,
          retryAfter: lockoutStatus.retryAfter,
        },
        { status: 403 }
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
        pin: users.pin,
      })
      .from(users)
      .where(eq(users.id, body.userId));

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const role = user.role as 'parent' | 'child' | 'guest';

    // SECURITY FIX: Only guests can login without a PIN
    // Parents and children MUST have a PIN set
    if (!user.pin) {
      if (role !== 'guest') {
        return NextResponse.json(
          {
            error: 'PIN not set. Please contact a parent to set your PIN.',
            pinRequired: true,
          },
          { status: 403 }
        );
      }

      // Guest login (no PIN required)
      const session = await createSession(user.id, role, {
        userAgent: request.headers.get('user-agent') || undefined,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      });

      if (!session) {
        return NextResponse.json(
          { error: 'Failed to create session' },
          { status: 500 }
        );
      }

      // Set cookies
      const cookieStore = await cookies();

      cookieStore.set('prism_session', session.token, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        expires: session.expiresAt,
        path: '/',
      });

      cookieStore.set('prism_user', user.id, {
        httpOnly: false,
        secure: isSecure,
        sameSite: 'lax',
        expires: session.expiresAt,
        path: '/',
      });

      return NextResponse.json({
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          color: user.color,
          avatarUrl: user.avatarUrl,
        },
        expiresAt: session.expiresAt.toISOString(),
        message: 'Logged in as guest',
      });
    }

    // PIN is required for non-guests
    if (!body.pin || typeof body.pin !== 'string') {
      return NextResponse.json(
        { error: 'PIN is required' },
        { status: 400 }
      );
    }

    // Verify PIN using bcrypt
    const isValidPin = await bcrypt.compare(body.pin, user.pin);

    if (!isValidPin) {
      const { remainingAttempts } = await recordFailedLogin(body.userId);

      return NextResponse.json(
        {
          error: 'Invalid PIN',
          remainingAttempts,
        },
        { status: 401 }
      );
    }

    // PIN is valid - clear any failed attempts
    await clearLoginAttempts(body.userId);

    // Create session in Redis
    const session = await createSession(user.id, role, {
      userAgent: request.headers.get('user-agent') || undefined,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    // Set session cookies
    const cookieStore = await cookies();

    // Session token - httpOnly for security
    cookieStore.set('prism_session', session.token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      expires: session.expiresAt,
      path: '/',
    });

    // User ID - accessible to JavaScript for UI purposes
    cookieStore.set('prism_user', user.id, {
      httpOnly: false,
      secure: isSecure,
      sameSite: 'lax',
      expires: session.expiresAt,
      path: '/',
    });

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        color: user.color,
        avatarUrl: user.avatarUrl,
      },
      expiresAt: session.expiresAt.toISOString(),
      message: 'Logged in successfully',
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
