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
import { getConfiguredPinLength } from '@/lib/services/pinLength';

interface FamilyMemberResponse {
  id: string;
  name: string;
  role: 'parent' | 'child' | 'guest';
  color: string;
  email: string | null;
  avatarUrl: string | null;
  hasPin: boolean;
  createdAt: string;
}

/** Display-only shape returned to unauthenticated callers (no UUIDs). */
interface PublicFamilyMemberResponse {
  id: ''; // empty — never a real UUID; loginIndex is the login token
  loginIndex: number;
  name: string;
  color: string;
  avatarUrl: string | null;
  hasPin: boolean;
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
      const data = await getCached('family:public', async () => {
        const results = await db
          .select({
            name: users.name,
            color: users.color,
            avatarUrl: users.avatarUrl,
            pin: users.pin,
          })
          .from(users)
          .orderBy(users.sortOrder, users.createdAt);

        const members: PublicFamilyMemberResponse[] = results.map((user, index) => ({
          id: '' as const,
          loginIndex: index,
          name: user.name,
          color: user.color,
          avatarUrl: user.avatarUrl,
          hasPin: !!user.pin,
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

    let hashedPin: string | null = null;
    if (body.pin) {
      const expectedLen = await getConfiguredPinLength();
      if (!new RegExp(`^\\d{${expectedLen}}$`).test(body.pin)) {
        return NextResponse.json(
          { error: `PIN must be exactly ${expectedLen} digits` },
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
        name: body.name.trim(),
        role: body.role,
        color: body.color,
        pin: hashedPin,
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
