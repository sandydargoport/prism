import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { layouts } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { createLayoutSchema, validateRequest } from '@/lib/validations';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const displayId = searchParams.get('displayId');

    let results;
    if (displayId) {
      results = await db
        .select()
        .from(layouts)
        .where(eq(layouts.displayId, displayId))
        .orderBy(desc(layouts.createdAt));
    } else {
      results = await db
        .select()
        .from(layouts)
        .orderBy(desc(layouts.createdAt));
    }

    return NextResponse.json({ layouts: results });
  } catch (error) {
    console.error('Error fetching layouts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch layouts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validation = validateRequest(createLayoutSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { name, isDefault, displayId, widgets, createdBy } = validation.data;

    // If setting as default, unset other defaults
    if (isDefault) {
      await db
        .update(layouts)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(layouts.isDefault, true));
    }

    const [newLayout] = await db
      .insert(layouts)
      .values({
        name,
        isDefault: isDefault || false,
        displayId: displayId || null,
        widgets,
        createdBy: createdBy || null,
      })
      .returning();

    if (!newLayout) {
      return NextResponse.json(
        { error: 'Failed to create layout' },
        { status: 500 }
      );
    }

    return NextResponse.json(newLayout, { status: 201 });
  } catch (error) {
    console.error('Error creating layout:', error);
    return NextResponse.json(
      { error: 'Failed to create layout' },
      { status: 500 }
    );
  }
}
