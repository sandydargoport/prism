import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { AuthResult } from '@/lib/auth';

export async function GET() {
  try {
    const rows = await db.select().from(settings);
    const result: Record<string, unknown> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return NextResponse.json({ settings: result });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth as AuthResult, 'canModifySettings');
  if (forbidden) return forbidden;

  try {
    const body = await request.json();

    if (!body.key || typeof body.key !== 'string') {
      return NextResponse.json(
        { error: 'key is required' },
        { status: 400 }
      );
    }

    if (body.value === undefined) {
      return NextResponse.json(
        { error: 'value is required' },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, body.key));

    if (existing) {
      await db
        .update(settings)
        .set({ value: body.value, updatedAt: new Date() })
        .where(eq(settings.key, body.key));
    } else {
      await db
        .insert(settings)
        .values({ key: body.key, value: body.value });
    }

    return NextResponse.json({ key: body.key, value: body.value });
  } catch (error) {
    console.error('Error updating setting:', error);
    return NextResponse.json(
      { error: 'Failed to update setting' },
      { status: 500 }
    );
  }
}
