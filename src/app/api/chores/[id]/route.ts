/**
 *
 * ENDPOINT: /api/chores/[id]
 * - GET:    Get a specific chore by ID
 * - PATCH:  Update a specific chore
 * - DELETE: Delete a specific chore
 *
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { chores, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { updateChoreSchema, validateRequest } from '@/lib/validations';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';

/**
 * Route params type
 */
interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/chores/[id]
 * Retrieves a single chore by its ID.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    // Validate UUID format
    if (!id || id.length < 10) {
      return NextResponse.json(
        { error: 'Invalid chore ID' },
        { status: 400 }
      );
    }

    // Fetch chore with assigned user data
    const [choreWithUser] = await db
      .select({
        id: chores.id,
        title: chores.title,
        description: chores.description,
        category: chores.category,
        frequency: chores.frequency,
        customIntervalDays: chores.customIntervalDays,
        startDay: chores.startDay,
        lastCompleted: chores.lastCompleted,
        nextDue: chores.nextDue,
        nextDueTime: chores.nextDueTime,
        pointValue: chores.pointValue,
        requiresApproval: chores.requiresApproval,
        enabled: chores.enabled,
        createdAt: chores.createdAt,
        updatedAt: chores.updatedAt,
        assignedUserId: users.id,
        assignedUserName: users.name,
        assignedUserColor: users.color,
        assignedUserAvatar: users.avatarUrl,
      })
      .from(chores)
      .leftJoin(users, eq(chores.assignedTo, users.id))
      .where(eq(chores.id, id));

    if (!choreWithUser) {
      return NextResponse.json(
        { error: 'Chore not found' },
        { status: 404 }
      );
    }

    // Format and return response
    return NextResponse.json({
      id: choreWithUser.id,
      title: choreWithUser.title,
      description: choreWithUser.description,
      category: choreWithUser.category,
      frequency: choreWithUser.frequency,
      customIntervalDays: choreWithUser.customIntervalDays,
      startDay: choreWithUser.startDay || null,
      lastCompleted: choreWithUser.lastCompleted?.toISOString() || null,
      nextDue: choreWithUser.nextDue || null,
      nextDueTime: choreWithUser.nextDueTime || null,
      pointValue: choreWithUser.pointValue,
      requiresApproval: choreWithUser.requiresApproval,
      enabled: choreWithUser.enabled,
      createdAt: choreWithUser.createdAt.toISOString(),
      updatedAt: choreWithUser.updatedAt.toISOString(),
      assignedTo: choreWithUser.assignedUserId
        ? {
            id: choreWithUser.assignedUserId,
            name: choreWithUser.assignedUserName!,
            color: choreWithUser.assignedUserColor!,
            avatarUrl: choreWithUser.assignedUserAvatar,
          }
        : null,
    });
  } catch (error) {
    logError('Error fetching chore:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chore' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/chores/[id]
 * Updates a specific chore.
 *
 * REQUEST BODY (all fields optional):
 * {
 *   title?: string
 *   description?: string | null
 *   assignedTo?: string | null
 *   schedule?: 'daily' | 'weekly' | 'monthly' | 'custom'
 *   scheduleDays?: number[] | null
 *   points?: number
 *   requiresApproval?: boolean
 *   enabled?: boolean
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const roleCheck = requireRole(auth, 'canManageChores');
  if (roleCheck) return roleCheck;

  try {
    const { id } = await params;
    const body = await request.json();

    // Check if chore exists
    const [existingChore] = await db
      .select({ id: chores.id })
      .from(chores)
      .where(eq(chores.id, id));

    if (!existingChore) {
      return NextResponse.json(
        { error: 'Chore not found' },
        { status: 404 }
      );
    }

    // Validate request body with partial schema
    const validation = validateRequest(updateChoreSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      ...validation.data,
      updatedAt: new Date(),
    };

    // Remove undefined values (only update provided fields)
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    // Execute update
    await db
      .update(chores)
      .set(updateData)
      .where(eq(chores.id, id));

    // Fetch and return updated chore
    const [updatedChoreWithUser] = await db
      .select({
        id: chores.id,
        title: chores.title,
        description: chores.description,
        category: chores.category,
        frequency: chores.frequency,
        customIntervalDays: chores.customIntervalDays,
        startDay: chores.startDay,
        lastCompleted: chores.lastCompleted,
        nextDue: chores.nextDue,
        nextDueTime: chores.nextDueTime,
        pointValue: chores.pointValue,
        requiresApproval: chores.requiresApproval,
        enabled: chores.enabled,
        createdAt: chores.createdAt,
        updatedAt: chores.updatedAt,
        assignedUserId: users.id,
        assignedUserName: users.name,
        assignedUserColor: users.color,
        assignedUserAvatar: users.avatarUrl,
      })
      .from(chores)
      .leftJoin(users, eq(chores.assignedTo, users.id))
      .where(eq(chores.id, id));

    if (!updatedChoreWithUser) {
      return NextResponse.json(
        { error: 'Chore not found after update' },
        { status: 404 }
      );
    }

    await invalidateEntity('chores');

    logActivity({
      userId: auth.userId,
      action: 'update',
      entityType: 'chore',
      entityId: id,
      summary: `Updated chore: ${updatedChoreWithUser.title}`,
    });

    return NextResponse.json({
      id: updatedChoreWithUser.id,
      title: updatedChoreWithUser.title,
      description: updatedChoreWithUser.description,
      category: updatedChoreWithUser.category,
      frequency: updatedChoreWithUser.frequency,
      customIntervalDays: updatedChoreWithUser.customIntervalDays,
      startDay: updatedChoreWithUser.startDay || null,
      lastCompleted: updatedChoreWithUser.lastCompleted?.toISOString() || null,
      nextDue: updatedChoreWithUser.nextDue || null,
      nextDueTime: updatedChoreWithUser.nextDueTime || null,
      pointValue: updatedChoreWithUser.pointValue,
      requiresApproval: updatedChoreWithUser.requiresApproval,
      enabled: updatedChoreWithUser.enabled,
      createdAt: updatedChoreWithUser.createdAt.toISOString(),
      updatedAt: updatedChoreWithUser.updatedAt.toISOString(),
      assignedTo: updatedChoreWithUser.assignedUserId
        ? {
            id: updatedChoreWithUser.assignedUserId,
            name: updatedChoreWithUser.assignedUserName!,
            color: updatedChoreWithUser.assignedUserColor!,
            avatarUrl: updatedChoreWithUser.assignedUserAvatar,
          }
        : null,
    });
  } catch (error) {
    logError('Error updating chore:', error);
    return NextResponse.json(
      { error: 'Failed to update chore' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chores/[id]
 * Deletes a specific chore.
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const roleCheck = requireRole(auth, 'canManageChores');
  if (roleCheck) return roleCheck;

  try {
    const { id } = await params;

    // Check if chore exists
    const [existingChore] = await db
      .select({ id: chores.id, title: chores.title })
      .from(chores)
      .where(eq(chores.id, id));

    if (!existingChore) {
      return NextResponse.json(
        { error: 'Chore not found' },
        { status: 404 }
      );
    }

    // Delete the chore (CASCADE will delete related completions)
    await db
      .delete(chores)
      .where(eq(chores.id, id));

    await invalidateEntity('chores');

    logActivity({
      userId: auth.userId,
      action: 'delete',
      entityType: 'chore',
      entityId: id,
      summary: `Deleted chore: ${existingChore.title}`,
    });

    return NextResponse.json({
      message: 'Chore deleted successfully',
      deletedChore: {
        id: existingChore.id,
        title: existingChore.title,
      },
    });
  } catch (error) {
    logError('Error deleting chore:', error);
    return NextResponse.json(
      { error: 'Failed to delete chore' },
      { status: 500 }
    );
  }
}
