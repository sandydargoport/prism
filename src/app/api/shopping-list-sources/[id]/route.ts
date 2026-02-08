import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { shoppingListSources } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth, requireRole } from '@/lib/auth';
import { invalidateCache } from '@/lib/cache/redis';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageIntegrations');
  if (forbidden) return forbidden;

  const { id } = await params;

  try {
    const [source] = await db
      .select()
      .from(shoppingListSources)
      .where(eq(shoppingListSources.id, id));

    if (!source) {
      return NextResponse.json(
        { error: 'Shopping list source not found' },
        { status: 404 }
      );
    }

    await db
      .delete(shoppingListSources)
      .where(eq(shoppingListSources.id, id));

    await invalidateCache('shopping-list-sources:*');
    await invalidateCache('shopping:*');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting shopping list source:', error);
    return NextResponse.json(
      { error: 'Failed to delete shopping list source' },
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

  const forbidden = requireRole(auth, 'canManageIntegrations');
  if (forbidden) return forbidden;

  const { id } = await params;

  try {
    const body = await request.json();

    const [source] = await db
      .select()
      .from(shoppingListSources)
      .where(eq(shoppingListSources.id, id));

    if (!source) {
      return NextResponse.json(
        { error: 'Shopping list source not found' },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (typeof body.syncEnabled === 'boolean') {
      updates.syncEnabled = body.syncEnabled;
    }

    if (body.externalListName !== undefined) {
      updates.externalListName = body.externalListName;
    }

    const [updated] = await db
      .update(shoppingListSources)
      .set(updates)
      .where(eq(shoppingListSources.id, id))
      .returning();

    await invalidateCache('shopping-list-sources:*');

    return NextResponse.json({
      id: updated!.id,
      userId: updated!.userId,
      provider: updated!.provider,
      externalListId: updated!.externalListId,
      externalListName: updated!.externalListName,
      shoppingListId: updated!.shoppingListId,
      syncEnabled: updated!.syncEnabled,
      lastSyncAt: updated!.lastSyncAt,
      lastSyncError: updated!.lastSyncError,
      createdAt: updated!.createdAt,
    });
  } catch (error) {
    console.error('Error updating shopping list source:', error);
    return NextResponse.json(
      { error: 'Failed to update shopping list source' },
      { status: 500 }
    );
  }
}
