import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { layouts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { updateLayoutSchema, validateRequest } from '@/lib/validations';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
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
    console.error('Error fetching layout:', error);
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
      ...validation.data,
      updatedAt: new Date(),
    };

    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

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
    console.error('Error updating layout:', error);
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
  try {
    const { id } = await params;

    const [existing] = await db
      .select({ id: layouts.id, name: layouts.name })
      .from(layouts)
      .where(eq(layouts.id, id));

    if (!existing) {
      return NextResponse.json(
        { error: 'Layout not found' },
        { status: 404 }
      );
    }

    await db
      .delete(layouts)
      .where(eq(layouts.id, id));

    return NextResponse.json({
      message: 'Layout deleted successfully',
      deletedLayout: {
        id: existing.id,
        name: existing.name,
      },
    });
  } catch (error) {
    console.error('Error deleting layout:', error);
    return NextResponse.json(
      { error: 'Failed to delete layout' },
      { status: 500 }
    );
  }
}
