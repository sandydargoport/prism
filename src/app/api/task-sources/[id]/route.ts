import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { taskSources } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth, requireRole } from '@/lib/auth';
import { invalidateCache } from '@/lib/cache/redis';

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

    const [source] = await db
      .select({
        id: taskSources.id,
        userId: taskSources.userId,
        provider: taskSources.provider,
        externalListId: taskSources.externalListId,
        externalListName: taskSources.externalListName,
        taskListId: taskSources.taskListId,
        syncEnabled: taskSources.syncEnabled,
        lastSyncAt: taskSources.lastSyncAt,
        lastSyncError: taskSources.lastSyncError,
        createdAt: taskSources.createdAt,
      })
      .from(taskSources)
      .where(eq(taskSources.id, id));

    if (!source) {
      return NextResponse.json(
        { error: 'Task source not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(source);
  } catch (error) {
    console.error('Error fetching task source:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task source' },
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

  try {
    const { id } = await params;
    const body = await request.json();

    const [existing] = await db
      .select()
      .from(taskSources)
      .where(eq(taskSources.id, id));

    if (!existing) {
      return NextResponse.json(
        { error: 'Task source not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if ('syncEnabled' in body) {
      updateData.syncEnabled = Boolean(body.syncEnabled);
    }

    if ('externalListName' in body) {
      updateData.externalListName = body.externalListName || null;
    }

    if ('accessToken' in body) {
      updateData.accessToken = body.accessToken || null;
    }

    if ('refreshToken' in body) {
      updateData.refreshToken = body.refreshToken || null;
    }

    if ('tokenExpiresAt' in body) {
      updateData.tokenExpiresAt = body.tokenExpiresAt ? new Date(body.tokenExpiresAt) : null;
    }

    if ('lastSyncAt' in body) {
      updateData.lastSyncAt = body.lastSyncAt ? new Date(body.lastSyncAt) : null;
    }

    if ('lastSyncError' in body) {
      updateData.lastSyncError = body.lastSyncError || null;
    }

    const [updated] = await db
      .update(taskSources)
      .set(updateData)
      .where(eq(taskSources.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: 'Task source not found after update' },
        { status: 404 }
      );
    }

    await invalidateCache('task-sources:*');

    // Don't return tokens in response
    return NextResponse.json({
      id: updated.id,
      userId: updated.userId,
      provider: updated.provider,
      externalListId: updated.externalListId,
      externalListName: updated.externalListName,
      taskListId: updated.taskListId,
      syncEnabled: updated.syncEnabled,
      lastSyncAt: updated.lastSyncAt,
      lastSyncError: updated.lastSyncError,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    console.error('Error updating task source:', error);
    return NextResponse.json(
      { error: 'Failed to update task source' },
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

  const forbidden = requireRole(auth, 'canManageIntegrations');
  if (forbidden) return forbidden;

  try {
    const { id } = await params;

    const [existing] = await db
      .select()
      .from(taskSources)
      .where(eq(taskSources.id, id));

    if (!existing) {
      return NextResponse.json(
        { error: 'Task source not found' },
        { status: 404 }
      );
    }

    await db.delete(taskSources).where(eq(taskSources.id, id));

    await invalidateCache('task-sources:*');

    return NextResponse.json({
      message: 'Task source deleted successfully',
      deletedSource: {
        id: existing.id,
        provider: existing.provider,
        externalListName: existing.externalListName,
      },
    });
  } catch (error) {
    console.error('Error deleting task source:', error);
    return NextResponse.json(
      { error: 'Failed to delete task source' },
      { status: 500 }
    );
  }
}
