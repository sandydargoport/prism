import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { layouts } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { updateLayoutSchema, validateRequest } from '@/lib/validations';
import { logError } from '@/lib/utils/logError';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    if (!id || id.length < 10) {
      return NextResponse.json(
        { error: 'Invalid layout ID' },
        { status: 400 }
      );
    }

    const [layout] = await db
      .select()
      .from(layouts)
      .where(eq(layouts.id, id));

    if (!layout) {
      return NextResponse.json(
        { error: 'Layout not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(layout);
  } catch (error) {
    logError('Error fetching layout:', error);
    return NextResponse.json(
      { error: 'Failed to fetch layout' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();

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

    const validation = validateRequest(updateLayoutSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    // If setting as default, unset other defaults
    if (validation.data.isDefault) {
      await db
        .update(layouts)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(layouts.isDefault, true));
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    // Map validated fields to update data
    const { name, widgets, isDefault, screensaverWidgets, screensaverMode, orientation, fontScale } = validation.data;
    if (name !== undefined) updateData.name = name;
    if (widgets !== undefined) updateData.widgets = widgets;
    if (isDefault !== undefined) updateData.isDefault = isDefault;
    if (screensaverWidgets !== undefined) updateData.screensaverWidgets = screensaverWidgets;
    if (screensaverMode !== undefined) updateData.screensaverMode = screensaverMode;
    if (orientation !== undefined) updateData.orientation = orientation;
    if (fontScale !== undefined) updateData.fontScale = fontScale;

    await db
      .update(layouts)
      .set(updateData)
      .where(eq(layouts.id, id));

    const [updated] = await db
      .select()
      .from(layouts)
      .where(eq(layouts.id, id));

    if (!updated) {
      return NextResponse.json(
        { error: 'Layout not found after update' },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    logError('Error updating layout:', error);
    return NextResponse.json(
      { error: 'Failed to update layout' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    const [existing] = await db
      .select({ id: layouts.id, name: layouts.name, isDefault: layouts.isDefault })
      .from(layouts)
      .where(eq(layouts.id, id));

    if (!existing) {
      return NextResponse.json(
        { error: 'Layout not found' },
        { status: 404 }
      );
    }

    // Count remaining layouts
    const allLayouts = await db.select({ id: layouts.id }).from(layouts);
    if (allLayouts.length <= 1) {
      return NextResponse.json(
        { error: 'Cannot delete the last dashboard' },
        { status: 400 }
      );
    }

    await db
      .delete(layouts)
      .where(eq(layouts.id, id));

    // If we deleted the default, make the oldest remaining layout the default
    if (existing.isDefault) {
      const [oldest] = await db
        .select({ id: layouts.id })
        .from(layouts)
        .orderBy(layouts.createdAt)
        .limit(1);
      if (oldest) {
        await db
          .update(layouts)
          .set({ isDefault: true, updatedAt: new Date() })
          .where(eq(layouts.id, oldest.id));
      }
    }

    return NextResponse.json({
      message: 'Layout deleted successfully',
      deletedLayout: {
        id: existing.id,
        name: existing.name,
      },
    });
  } catch (error) {
    logError('Error deleting layout:', error);
    return NextResponse.json(
      { error: 'Failed to delete layout' },
      { status: 500 }
    );
  }
}
