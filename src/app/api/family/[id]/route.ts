import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole, type AuthResult } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { users, calendarGroups, settings } from '@/lib/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';
import { MIN_PIN_LENGTH, MAX_PIN_LENGTH } from '@/lib/constants';

/** Mirrors the same-named helper in the parent /api/family route — checked
 *  locally per-route rather than shared, matching this codebase's existing
 *  convention (see also /api/settings). */
async function setupIsComplete(): Promise<boolean> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, 'setupComplete'));
    return !!row;
  } catch {
    return false;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    const [member] = await db
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
      .where(eq(users.id, id));

    if (!member) {
      return NextResponse.json(
        { error: 'Family member not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: member.id,
      name: member.name,
      role: member.role,
      color: member.color,
      email: member.email,
      avatarUrl: member.avatarUrl,
      hasPin: !!member.pin,
      pinLength: member.pinLength,
      createdAt: member.createdAt.toISOString(),
    });
  } catch (error) {
    logError('Error fetching family member:', error);
    return NextResponse.json(
      { error: 'Failed to fetch family member' },
      { status: 500 }
    );
  }
}


export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  let auth: AuthResult | null = null;

  if (authResult instanceof NextResponse) {
    // Bootstrap exception, narrowly scoped like the one on POST /api/family:
    // the setup wizard's Family step lets a brand-new install fix a mistake
    // (typo'd name, wrong color/role/PIN) on a member it just created — all
    // before any session exists to authenticate as. Once setup is complete
    // this path is unreachable and normal auth is enforced as before.
    const allowUnauthedSetup = !(await setupIsComplete());
    if (!allowUnauthedSetup) return authResult;
  } else {
    auth = authResult;
  }

  try {
    const { id } = await params;
    const body = await request.json();

    // Editing another user or changing roles requires canManageUsers —
    // only enforced once a real session exists (see bootstrap exception above).
    if (auth) {
      const editingSelf = id === auth.userId;
      const changingRole = body.role !== undefined;
      if (!editingSelf || changingRole) {
        const forbidden = requireRole(auth, 'canManageUsers');
        if (forbidden) return forbidden;
      }
    }

    // Get current member
    const [currentMember] = await db
      .select()
      .from(users)
      .where(eq(users.id, id));

    if (!currentMember) {
      return NextResponse.json(
        { error: 'Family member not found' },
        { status: 404 }
      );
    }

    // Build updates object
    const updates: Partial<typeof users.$inferInsert> = {};

    if (body.name && typeof body.name === 'string') {
      const trimmedName = body.name.trim();
      if (!trimmedName) {
        return NextResponse.json(
          { error: 'Name is required' },
          { status: 400 }
        );
      }

      // Names must be unique (case-insensitive, trimmed) across every OTHER
      // member — mirrors the same check on member creation (POST /api/family).
      const otherNames = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(ne(users.id, id));
      if (otherNames.some((u) => u.name.trim().toLowerCase() === trimmedName.toLowerCase())) {
        return NextResponse.json(
          { error: `A member named "${trimmedName}" already exists. Please use a different name.` },
          { status: 409 }
        );
      }

      updates.name = trimmedName;
    }

    if (body.role && ['parent', 'child', 'guest'].includes(body.role)) {
      updates.role = body.role;
    }

    if (body.color && /^#[0-9A-Fa-f]{6}$/.test(body.color)) {
      updates.color = body.color;
    }

    if (body.email !== undefined) {
      if (body.email === null || body.email === '') {
        updates.email = null;
      } else if (typeof body.email === 'string') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(body.email)) {
          updates.email = body.email.trim();
        }
      }
    }

    if (body.avatarUrl !== undefined) {
      updates.avatarUrl = body.avatarUrl || null;
    }

    // Per-member PIN length (4/5/6). Validated up front so a PIN submitted in
    // the same request is checked against the NEW length, not the stale one.
    if (body.pinLength !== undefined) {
      const n = Math.round(Number(body.pinLength));
      if (!Number.isFinite(n) || n < MIN_PIN_LENGTH || n > MAX_PIN_LENGTH) {
        return NextResponse.json(
          { error: `pinLength must be between ${MIN_PIN_LENGTH} and ${MAX_PIN_LENGTH}` },
          { status: 400 }
        );
      }
      updates.pinLength = n;
    }

    // Handle PIN change
    if (body.pin !== undefined) {
      // Changing an existing PIN requires proving the current one — including
      // when an admin edits another member. We deliberately do NOT let a parent
      // silently reset another member's PIN (that would let one parent lock out
      // a co-parent). Recovery for a forgotten/locked-out PIN is the offline
      // `scripts/reset-pin.js` helper instead, which needs server access.
      //
      // Exception: the unauthenticated setup-bootstrap window (auth === null,
      // see above) — there's no "co-parent" to protect yet, and requiring the
      // exact PIN just (mis)typed a moment ago to fix a typo would defeat the
      // point of in-wizard editing.
      if (currentMember.pin && auth) {
        if (!body.currentPin) {
          return NextResponse.json(
            { error: 'Current PIN is required to change PIN' },
            { status: 400 }
          );
        }

        // Verify current PIN
        const isPinValid = await bcrypt.compare(body.currentPin, currentMember.pin);
        if (!isPinValid) {
          return NextResponse.json(
            { error: 'Current PIN is incorrect' },
            { status: 401 }
          );
        }
      }

      // Validate and hash new PIN — must match this member's own configured
      // length (the request's `pinLength` if changing it in the same call,
      // otherwise the member's already-persisted length).
      if (body.pin === null || body.pin === '') {
        // Remove PIN
        updates.pin = null;
      } else {
        const expectedLen = updates.pinLength ?? currentMember.pinLength;
        if (new RegExp(`^\\d{${expectedLen}}$`).test(body.pin)) {
          // Hash and set new PIN
          updates.pin = await bcrypt.hash(body.pin, 12);
        } else {
          return NextResponse.json(
            { error: `PIN must be exactly ${expectedLen} digits` },
            { status: 400 }
          );
        }
      }
    }

    // Perform update if there are changes
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid updates provided' },
        { status: 400 }
      );
    }

    updates.updatedAt = new Date();

    const [updatedMember] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();

    if (!updatedMember) {
      return NextResponse.json(
        { error: 'Failed to update family member' },
        { status: 500 }
      );
    }

    // Sync calendar group color if user color was updated
    if (updates.color) {
      await db
        .update(calendarGroups)
        .set({ color: updates.color, updatedAt: new Date() })
        .where(and(
          eq(calendarGroups.userId, id),
          eq(calendarGroups.type, 'user')
        ));
    }

    await invalidateEntity('family');
    await invalidateEntity('calendar-groups');

    if (auth) {
      logActivity({
        userId: auth.userId,
        action: 'update',
        entityType: 'user',
        entityId: updatedMember.id,
        summary: `Updated member: ${updatedMember.name}`,
      });
    }

    return NextResponse.json({
      id: updatedMember.id,
      name: updatedMember.name,
      role: updatedMember.role,
      color: updatedMember.color,
      email: updatedMember.email,
      avatarUrl: updatedMember.avatarUrl,
      hasPin: !!updatedMember.pin,
      pinLength: updatedMember.pinLength,
      createdAt: updatedMember.createdAt.toISOString(),
    });
  } catch (error) {
    logError('Error updating family member:', error);
    return NextResponse.json(
      { error: 'Failed to update family member' },
      { status: 500 }
    );
  }
}


export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  let auth: AuthResult | null = null;

  if (authResult instanceof NextResponse) {
    // Bootstrap exception mirroring PATCH above — lets the setup wizard
    // remove a member it just added, before any session exists. Unreachable
    // once setup is complete.
    const allowUnauthedSetup = !(await setupIsComplete());
    if (!allowUnauthedSetup) return authResult;
  } else {
    auth = authResult;
    const forbidden = requireRole(auth, 'canManageUsers');
    if (forbidden) return forbidden;
  }

  try {
    const { id } = await params;

    const [currentMember] = await db
      .select()
      .from(users)
      .where(eq(users.id, id));

    if (!currentMember) {
      return NextResponse.json(
        { error: 'Family member not found' },
        { status: 404 }
      );
    }

    // Check parent count + delete atomically to prevent race condition
    await db.transaction(async (tx) => {
      if (currentMember.role === 'parent') {
        const parentCount = await tx
          .select({ count: users.id })
          .from(users)
          .where(eq(users.role, 'parent'));

        if (parentCount.length <= 1) {
          throw new Error('Cannot delete the last parent');
        }
      }

      await tx.delete(users).where(eq(users.id, id));
    });

    await invalidateEntity('family');

    if (auth) {
      logActivity({
        userId: auth.userId,
        action: 'delete',
        entityType: 'user',
        entityId: id,
        summary: `Removed member: ${currentMember.name}`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Cannot delete the last parent') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    logError('Error deleting family member:', error);
    return NextResponse.json(
      { error: 'Failed to delete family member' },
      { status: 500 }
    );
  }
}
