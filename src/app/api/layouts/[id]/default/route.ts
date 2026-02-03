import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { layouts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    const [existing] = await db
      .select({ id: layouts.id })
      .from(layouts)
      .where(eq(layouts.id, id));

    if (!existing) {
      return NextResponse.json(
        { error: 'Layout not found' },
        { status: 404 }
      );
    }

    // Unset all other defaults
    await db
      .update(layouts)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(layouts.isDefault, true));

    // Set this one as default
    await db
      .update(layouts)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(layouts.id, id));

    const [updated] = await db
      .select()
      .from(layouts)
      .where(eq(layouts.id, id));

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error setting default layout:', error);
    return NextResponse.json(
      { error: 'Failed to set default layout' },
      { status: 500 }
    );
  }
}
