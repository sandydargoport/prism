/**
 *
 * ENDPOINT: /api/maintenance/[id]
 * - GET:    Get a specific maintenance reminder by ID
 * - PATCH:  Update a specific maintenance reminder
 * - DELETE: Delete a specific maintenance reminder
 *
 * ENDPOINT: /api/maintenance/[id]/complete
 * - POST:   Mark maintenance as completed
 *
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { maintenanceReminders, maintenanceCompletions, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createMaintenanceSchema, completeMaintenanceSchema, validateRequest } from '@/lib/validations';

/**
 * Route params type
 */
interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/maintenance/[id]
 * Retrieves a single maintenance reminder by its ID.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    const [reminderWithUser] = await db
      .select({
        id: maintenanceReminders.id,
        title: maintenanceReminders.title,
        category: maintenanceReminders.category,
        description: maintenanceReminders.description,
        schedule: maintenanceReminders.schedule,
        customIntervalDays: maintenanceReminders.customIntervalDays,
        lastCompleted: maintenanceReminders.lastCompleted,
        nextDue: maintenanceReminders.nextDue,
        notes: maintenanceReminders.notes,
        createdAt: maintenanceReminders.createdAt,
        updatedAt: maintenanceReminders.updatedAt,
        assignedUserId: users.id,
        assignedUserName: users.name,
        assignedUserColor: users.color,
      })
      .from(maintenanceReminders)
      .leftJoin(users, eq(maintenanceReminders.assignedTo, users.id))
      .where(eq(maintenanceReminders.id, id));

    if (!reminderWithUser) {
      return NextResponse.json(
        { error: 'Maintenance reminder not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: reminderWithUser.id,
      title: reminderWithUser.title,
      category: reminderWithUser.category,
      description: reminderWithUser.description,
      schedule: reminderWithUser.schedule,
      customIntervalDays: reminderWithUser.customIntervalDays,
      lastCompleted: reminderWithUser.lastCompleted?.toISOString() || null,
      nextDue: reminderWithUser.nextDue,
      notes: reminderWithUser.notes,
      createdAt: reminderWithUser.createdAt.toISOString(),
      updatedAt: reminderWithUser.updatedAt.toISOString(),
      assignedTo: reminderWithUser.assignedUserId ? {
        id: reminderWithUser.assignedUserId,
        name: reminderWithUser.assignedUserName,
        color: reminderWithUser.assignedUserColor,
      } : null,
    });
  } catch (error) {
    console.error('Error fetching maintenance reminder:', error);
    return NextResponse.json(
      { error: 'Failed to fetch maintenance reminder' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/maintenance/[id]
 * Updates a specific maintenance reminder.
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();

    // Check if reminder exists
    const [existingReminder] = await db
      .select({ id: maintenanceReminders.id })
      .from(maintenanceReminders)
      .where(eq(maintenanceReminders.id, id));

    if (!existingReminder) {
      return NextResponse.json(
        { error: 'Maintenance reminder not found' },
        { status: 404 }
      );
    }

    // Validate request body
    const validation = validateRequest(createMaintenanceSchema.partial(), body);
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

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    // Execute update
    await db
      .update(maintenanceReminders)
      .set(updateData)
      .where(eq(maintenanceReminders.id, id));

    // Fetch and return updated reminder
    const [updatedReminderWithUser] = await db
      .select({
        id: maintenanceReminders.id,
        title: maintenanceReminders.title,
        category: maintenanceReminders.category,
        description: maintenanceReminders.description,
        schedule: maintenanceReminders.schedule,
        customIntervalDays: maintenanceReminders.customIntervalDays,
        lastCompleted: maintenanceReminders.lastCompleted,
        nextDue: maintenanceReminders.nextDue,
        notes: maintenanceReminders.notes,
        createdAt: maintenanceReminders.createdAt,
        updatedAt: maintenanceReminders.updatedAt,
        assignedUserId: users.id,
        assignedUserName: users.name,
        assignedUserColor: users.color,
      })
      .from(maintenanceReminders)
      .leftJoin(users, eq(maintenanceReminders.assignedTo, users.id))
      .where(eq(maintenanceReminders.id, id));

    if (!updatedReminderWithUser) {
      return NextResponse.json(
        { error: 'Maintenance reminder not found after update' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: updatedReminderWithUser.id,
      title: updatedReminderWithUser.title,
      category: updatedReminderWithUser.category,
      description: updatedReminderWithUser.description,
      schedule: updatedReminderWithUser.schedule,
      customIntervalDays: updatedReminderWithUser.customIntervalDays,
      lastCompleted: updatedReminderWithUser.lastCompleted?.toISOString() || null,
      nextDue: updatedReminderWithUser.nextDue,
      notes: updatedReminderWithUser.notes,
      createdAt: updatedReminderWithUser.createdAt.toISOString(),
      updatedAt: updatedReminderWithUser.updatedAt.toISOString(),
      assignedTo: updatedReminderWithUser.assignedUserId ? {
        id: updatedReminderWithUser.assignedUserId,
        name: updatedReminderWithUser.assignedUserName,
        color: updatedReminderWithUser.assignedUserColor,
      } : null,
    });
  } catch (error) {
    console.error('Error updating maintenance reminder:', error);
    return NextResponse.json(
      { error: 'Failed to update maintenance reminder' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/maintenance/[id]
 * Deletes a specific maintenance reminder.
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    // Check if reminder exists
    const [existingReminder] = await db
      .select({ id: maintenanceReminders.id, title: maintenanceReminders.title })
      .from(maintenanceReminders)
      .where(eq(maintenanceReminders.id, id));

    if (!existingReminder) {
      return NextResponse.json(
        { error: 'Maintenance reminder not found' },
        { status: 404 }
      );
    }

    // Delete the reminder (CASCADE will delete completions)
    await db
      .delete(maintenanceReminders)
      .where(eq(maintenanceReminders.id, id));

    return NextResponse.json({
      message: 'Maintenance reminder deleted successfully',
      deletedReminder: {
        id: existingReminder.id,
        title: existingReminder.title,
      },
    });
  } catch (error) {
    console.error('Error deleting maintenance reminder:', error);
    return NextResponse.json(
      { error: 'Failed to delete maintenance reminder' },
      { status: 500 }
    );
  }
}
