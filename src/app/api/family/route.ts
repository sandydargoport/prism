import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole, optionalAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { settings, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

import bcrypt from 'bcryptjs';
import { getCached } from '@/lib/cache/redis';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';
import { MIN_PIN_LENGTH, MAX_PIN_LENGTH, DEFAULT_PIN_LENGTH } from '@/lib/constants';

interface FamilyMemberResponse {
  id: string;
  name: string;
  role: 'parent' | 'child' | 'guest';
  color: string;
  email: string | null;
  avatarUrl: string | null;
  hasPin: boolean;
  /** Per-member PIN length (4/5/6). Not sensitive — every PIN pad needs it. */
  pinLength: number;
  createdAt: string;
}

/** Display-only shape returned to unauthenticated callers (no UUIDs). */
interface PublicFamilyMemberResponse {
  id: ''; // empty — never a real UUID; loginIndex is the login token
  loginIndex: number;
  name: string;
  // Role isn't sensitive (just parent/child/guest) and callers like the
  // Settings PIN gate need it to filter to parents-only *before* the user
  // has authenticated — omitting it previously made every member look like
  // a parent (see the unauthenticated branch's `!m.role` fallback).
  role: 'parent' | 'child' | 'guest';
  color: string;
  avatarUrl: string | null;
  hasPin: boolean;
  /** Per-member PIN length (4/5/6). Not sensitive — the login pad needs it
   *  to know how many digits to expect before the user has authenticated. */
  pinLength: number;
}

async function setupIsComplete(): Promise<boolean> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, 'setupComplete'));
    return !!row;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await optionalAuth();

    // -----------------------------------------------------------------------
    // Unauthenticated: return display-only list with ordinal login indices.
    // No UUIDs exposed — the login endpoint accepts memberIndex instead.
    // -----------------------------------------------------------------------
    if (!auth) {
      // Setup-bootstrap: before setup completes there's no session yet, but the
      // wizard needs REAL member ids to display + edit the family it's building
      // (going back to the Family step, or reloading, must re-show the members).
      // Mirrors the POST/PATCH/DELETE bootstrap exception; the window closes the
      // instant setupComplete is set. Returned fresh (never cached) so real ids
      // can't leak into the cached public response.
      if (!(await setupIsComplete())) {
        const rows = await db
          .select({
            id: users.id,
            name: users.name,
            role: users.role,
            color: users.color,
            avatarUrl: users.avatarUrl,
            pin: users.pin,
            pinLength: users.pinLength,
          })
          .from(users)
          .orderBy(users.sortOrder, users.createdAt);
        const members = rows.map((user) => ({
          id: user.id,
          name: user.name,
          role: user.role as 'parent' | 'child' | 'guest',
          color: user.color,
          avatarUrl: user.avatarUrl,
          hasPin: !!user.pin,
          pinLength: user.pinLength,
        }));
        return NextResponse.json({ members, total: members.length });
      }

      const data = await getCached('family:public', async () => {
        const results = await db
          .select({
            name: users.name,
            role: users.role,
            color: users.color,
            avatarUrl: users.avatarUrl,
            pin: users.pin,
            pinLength: users.pinLength,
          })
          .from(users)
          .orderBy(users.sortOrder, users.createdAt);

        const members: PublicFamilyMemberResponse[] = results.map((user, index) => ({
          id: '' as const,
          loginIndex: index,
          name: user.name,
          role: user.role as 'parent' | 'child' | 'guest',
          color: user.color,
          avatarUrl: user.avatarUrl,
          hasPin: !!user.pin,
          pinLength: user.pinLength,
        }));

        return { members, total: members.length };
      }, 600);

      return NextResponse.json(data);
    }

    // -----------------------------------------------------------------------
    // Authenticated: return full data including UUIDs (existing behaviour).
    // -----------------------------------------------------------------------
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const cacheKey = role ? `family:role:${role}` : 'family:all';

    const data = await getCached(cacheKey, async () => {
      const results = await db
        .select({
          id: users.id,
          name: users.name,
          role: users.role,
          color: users.color,
          email: users.email,
          avatarUrl: users.avatarUrl,
          pin: users.pin,
          pinLength: users.pinLength,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(users.sortOrder, users.createdAt);

      let filteredResults = results;
      if (role && ['parent', 'child', 'guest'].includes(role)) {
        filteredResults = results.filter((u) => u.role === role);
      }

      const members: FamilyMemberResponse[] = filteredResults.map((user) => ({
        id: user.id,
        name: user.name,
        role: user.role as 'parent' | 'child' | 'guest',
        color: user.color,
        email: user.email,
        avatarUrl: user.avatarUrl,
        hasPin: !!user.pin,
        pinLength: user.pinLength,
        createdAt: user.createdAt.toISOString(),
      }));

      return { members, total: members.length };
    }, 600);

    return NextResponse.json(data);
  } catch (error) {
    logError('Error fetching family members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch family members' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  let auth: { userId: string; role: 'parent' | 'child' | 'guest' } | null = null;

  if (authResult instanceof NextResponse) {
    const allowUnauthedSetup = !(await setupIsComplete());
    // After setup is complete, normal auth is always required.
    if (!allowUnauthedSetup) return authResult;
    // During setup bootstrap we permit member creation without an active session.
  } else {
    auth = authResult;
    // Outside setup, enforce normal parent permission.
    const forbidden = requireRole(auth, 'canManageUsers');
    if (forbidden) return forbidden;
  }

  try {
    const body = await request.json();

    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const trimmedName = body.name.trim();
    if (!trimmedName) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Names must be unique (case-insensitive, trimmed) — two members with the
    // same name break login/admin member selection, which key off name alone
    // in several places (e.g. ordinal member selection, avatar-grid taps).
    const existingNames = await db.select({ name: users.name }).from(users);
    if (existingNames.some((u) => u.name.trim().toLowerCase() === trimmedName.toLowerCase())) {
      return NextResponse.json(
        { error: `A member named "${trimmedName}" already exists. Please use a different name.` },
        { status: 409 }
      );
    }

    if (!body.role || !['parent', 'child', 'guest'].includes(body.role)) {
      return NextResponse.json(
        { error: 'Role must be "parent", "child", or "guest"' },
        { status: 400 }
      );
    }

    if (!body.color || !/^#[0-9A-Fa-f]{6}$/.test(body.color)) {
      return NextResponse.json(
        { error: 'Color must be a valid hex color (e.g., #3B82F6)' },
        { status: 400 }
      );
    }

    // Per-member PIN length: an explicit, valid `pinLength` on the request
    // wins; otherwise fall back to the plain built-in default (there is no
    // family-wide default setting any more — every member's length is their
    // own choice, made at creation time).
    let memberPinLength = DEFAULT_PIN_LENGTH;
    if (body.pinLength !== undefined) {
      const n = Math.round(Number(body.pinLength));
      if (!Number.isFinite(n) || n < MIN_PIN_LENGTH || n > MAX_PIN_LENGTH) {
        return NextResponse.json(
          { error: `pinLength must be between ${MIN_PIN_LENGTH} and ${MAX_PIN_LENGTH}` },
          { status: 400 }
        );
      }
      memberPinLength = n;
    }

    let hashedPin: string | null = null;
    if (body.pin) {
      if (!new RegExp(`^\\d{${memberPinLength}}$`).test(body.pin)) {
        return NextResponse.json(
          { error: `PIN must be exactly ${memberPinLength} digits` },
          { status: 400 }
        );
      }
      hashedPin = await bcrypt.hash(body.pin, 12);
    }

    if (body.email && typeof body.email === 'string') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        );
      }
    }

    const [newMember] = await db
      .insert(users)
      .values({
        name: trimmedName,
        role: body.role,
        color: body.color,
        pin: hashedPin,
        pinLength: memberPinLength,
        email: body.email?.trim() || null,
        avatarUrl: body.avatarUrl || null,
        preferences: body.preferences || {},
      })
      .returning();

    if (!newMember) {
      return NextResponse.json(
        { error: 'Failed to create family member' },
        { status: 500 }
      );
    }

    const response: FamilyMemberResponse = {
      id: newMember.id,
      name: newMember.name,
      role: newMember.role as 'parent' | 'child' | 'guest',
      color: newMember.color,
      email: newMember.email,
      avatarUrl: newMember.avatarUrl,
      hasPin: !!hashedPin,
      pinLength: newMember.pinLength,
      createdAt: newMember.createdAt.toISOString(),
    };

    await invalidateEntity('family');

    if (auth) {
      logActivity({
        userId: auth.userId,
        action: 'create',
        entityType: 'user',
        entityId: newMember.id,
        summary: `Added member: ${newMember.name}`,
      });
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    logError('Error creating family member:', error);
    return NextResponse.json(
      { error: 'Failed to create family member' },
      { status: 500 }
    );
  }
}
