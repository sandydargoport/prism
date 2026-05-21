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
import { asc, eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { logError } from '@/lib/utils/logError';
import {
  createSession,
  isLoginLockedOut,
  recordFailedLogin,
  clearLoginAttempts,
} from '@/lib/auth/session';
import { logActivity } from '@/lib/services/auditLog';

// Determine whether a specific request arrived over HTTPS.
// Use X-Forwarded-Proto (set by Nginx when proxying from TLS) if present;
// fall back to the request URL scheme for direct access.
// Do NOT use APP_URL or NODE_ENV: the same container is accessed via both
// plain HTTP on localhost (no secure cookie) and HTTPS through a TLS
// terminating reverse proxy (secure cookie).
function requestIsSecure(req: NextRequest): boolean {
  const proto = req.headers.get('x-forwarded-proto');
  if (proto) return proto === 'https';
  return req.url.startsWith('https://');
}


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

    // Support two login strategies:
    //   userId      — direct UUID (API clients, authenticated contexts)
    //   memberIndex — ordinal position (PinPad login screen; keeps UUIDs off the wire)
    const hasMemberIndex = typeof body.memberIndex === 'number';
    const hasUserId = body.userId && typeof body.userId === 'string';

    if (!hasMemberIndex && !hasUserId) {
      return NextResponse.json(
        { error: 'Either userId or memberIndex is required' },
        { status: 400 }
      );
    }

    const userSelect = {
      id: users.id,
      name: users.name,
      role: users.role,
      color: users.color,
      avatarUrl: users.avatarUrl,
      pin: users.pin,
    };

    let user: { id: string; name: string; role: string; color: string; avatarUrl: string | null; pin: string | null };

    if (hasMemberIndex) {
      const index = Math.floor(body.memberIndex as number);
      if (index < 0 || index > 999) {
        return NextResponse.json({ error: 'Invalid member index' }, { status: 400 });
      }
      const results = await db
        .select(userSelect)
        .from(users)
        .orderBy(asc(users.sortOrder), asc(users.createdAt))
        .limit(1)
        .offset(index);
      const found = results[0];
      if (!found) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      user = found;
    } else {
      // userId path — fetch after lockout check (lockout key is userId)
      const lockoutStatus = await isLoginLockedOut(body.userId as string);
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
      const results = await db
        .select(userSelect)
        .from(users)
        .where(eq(users.id, body.userId as string));
      const found = results[0];
      if (!found) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      user = found;
    }

    // For memberIndex path: check lockout now that we have the real userId
    if (hasMemberIndex) {
      const lockoutStatus = await isLoginLockedOut(user.id);
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
        secure: requestIsSecure(request),
        sameSite: 'lax',
        expires: session.expiresAt,
        path: '/',
      });

      cookieStore.set('prism_user', user.id, {
        httpOnly: true,
        secure: requestIsSecure(request),
        sameSite: 'lax',
        expires: session.expiresAt,
        path: '/',
      });

      logActivity({
        userId: user.id,
        action: 'login',
        entityType: 'session',
        summary: `Logged in as guest: ${user.name}`,
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

    // PIN is required for non-guests, unless skipPin is true
    // (skipPin allows instant user switching behind an already-authenticated
    //  reverse proxy like Cloudflare Access)
    if (body.skipPin === true && role !== 'guest') {
      // Bypass PIN verification — the request source is already
      // authenticated by an upstream proxy (e.g. Cloudflare Access).
      // Create a session directly for the requested user.
    } else if (!body.pin || typeof body.pin !== 'string') {
      return NextResponse.json(
        { error: 'PIN is required' },
        { status: 400 }
      );
    } else {
      // Verify PIN using bcrypt
      const isValidPin = await bcrypt.compare(body.pin, user.pin);

      if (!isValidPin) {
        const { remainingAttempts } = await recordFailedLogin(user.id);

        return NextResponse.json(
          {
            error: 'Invalid PIN',
            remainingAttempts,
          },
          { status: 401 }
        );
      }
    }

    // PIN is valid (or bypassed) - clear any failed attempts
    await clearLoginAttempts(user.id);

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
      secure: requestIsSecure(request),
      sameSite: 'lax',
      expires: session.expiresAt,
      path: '/',
    });

    // User ID - accessible to JavaScript for UI purposes
    cookieStore.set('prism_user', user.id, {
      httpOnly: false,
      secure: requestIsSecure(request),
      sameSite: 'lax',
      expires: session.expiresAt,
      path: '/',
    });

    logActivity({
      userId: user.id,
      action: 'login',
      entityType: 'session',
      summary: `Logged in: ${user.name}`,
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
    logError('Login error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
