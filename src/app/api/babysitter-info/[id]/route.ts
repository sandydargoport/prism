import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { babysitterInfo } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { invalidateCache } from '@/lib/cache/redis';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;

  const { id } = await context.params;

  try {
    const body = await request.json();

    const [existing] = await db
      .select()
      .from(babysitterInfo)
      .where(eq(babysitterInfo.id, id));

    if (!existing) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const updates: Partial<{
      section: 'emergency_contact' | 'house_info' | 'child_info' | 'house_rule';
      sortOrder: number;
      content: unknown;
      isSensitive: boolean;
      updatedAt: Date;
    }> = { updatedAt: new Date() };

    if (body.section !== undefined) {
      const validSections = ['emergency_contact', 'house_info', 'child_info', 'house_rule'];
      if (!validSections.includes(body.section)) {
        return NextResponse.json(
          { error: `Invalid section. Must be one of: ${validSections.join(', ')}` },
          { status: 400 }
        );
      }
      updates.section = body.section;
    }
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;
    if (body.content !== undefined) updates.content = body.content;
    if (body.isSensitive !== undefined) updates.isSensitive = body.isSensitive;

    const [updated] = await db
      .update(babysitterInfo)
      .set(updates)
      .where(eq(babysitterInfo.id, id))
      .returning();

    await invalidateCache('babysitter-info:*');

    return NextResponse.json({
      item: {
        id: updated!.id,
        section: updated!.section,
        sortOrder: updated!.sortOrder,
        content: updated!.content,
        isSensitive: updated!.isSensitive,
        createdAt: updated!.createdAt.toISOString(),
        updatedAt: updated!.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error updating babysitter info:', error);
    return NextResponse.json(
      { error: 'Failed to update babysitter info' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;

  const { id } = await context.params;

  try {
    const [existing] = await db
      .select()
      .from(babysitterInfo)
      .where(eq(babysitterInfo.id, id));

    if (!existing) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    await db.delete(babysitterInfo).where(eq(babysitterInfo.id, id));

    await invalidateCache('babysitter-info:*');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting babysitter info:', error);
    return NextResponse.json(
      { error: 'Failed to delete babysitter info' },
      { status: 500 }
    );
  }
}
