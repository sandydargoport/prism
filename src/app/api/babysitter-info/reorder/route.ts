import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { babysitterInfo } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { invalidateCache } from '@/lib/cache/redis';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;

  try {
    const body = await request.json();

    if (!body.section || !Array.isArray(body.itemIds)) {
      return NextResponse.json(
        { error: 'section and itemIds array are required' },
        { status: 400 }
      );
    }

    const validSections = ['emergency_contact', 'house_info', 'child_info', 'house_rule'];
    if (!validSections.includes(body.section)) {
      return NextResponse.json(
        { error: `Invalid section. Must be one of: ${validSections.join(', ')}` },
        { status: 400 }
      );
    }

    // Update sort order for each item
    await db.transaction(async (tx) => {
      for (let i = 0; i < body.itemIds.length; i++) {
        await tx
          .update(babysitterInfo)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(eq(babysitterInfo.id, body.itemIds[i]));
      }
    });

    await invalidateCache('babysitter-info:*');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reordering babysitter info:', error);
    return NextResponse.json(
      { error: 'Failed to reorder babysitter info' },
      { status: 500 }
    );
  }
}
