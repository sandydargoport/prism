/**
 * ============================================================================
 * PRISM - Maintenance Completion API Route
 * ============================================================================
 *
 * ENDPOINT: /api/maintenance/[id]/complete
 * - POST: Mark maintenance as completed
 *
 * This creates a completion record and updates the reminder's nextDue date
 * based on the schedule (monthly, quarterly, annually, or custom).
 *
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { maintenanceReminders, maintenanceCompletions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { completeMaintenanceSchema, validateRequest } from '@/lib/validations';

/**
 * Route params type
 */
interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Calculate next due date based on schedule
 */
function calculateNextDue(schedule: string, customIntervalDays: number | null): string {
  const today = new Date();
  const nextDue = new Date(today);

  switch (schedule) {
    case 'monthly':
      nextDue.setMonth(nextDue.getMonth() + 1);
      break;
    case 'quarterly':
      nextDue.setMonth(nextDue.getMonth() + 3);
      break;
    case 'annually':
      nextDue.setFullYear(nextDue.getFullYear() + 1);
      break;
    case 'custom':
      if (customIntervalDays) {
        nextDue.setDate(nextDue.getDate() + customIntervalDays);
      } else {
        // Default to 30 days if custom interval not specified
        nextDue.setDate(nextDue.getDate() + 30);
      }
      break;
    default:
      // Default to monthly
      nextDue.setMonth(nextDue.getMonth() + 1);
  }

  return nextDue.toISOString().split('T')[0]!;
}

/**
 * POST /api/maintenance/[id]/complete
 * ============================================================================
 * Records a maintenance completion and updates the next due date.
 *
 * REQUEST BODY:
 * {
 *   completedBy?: string (user UUID)
 *   cost?: number (how much it cost)
 *   vendor?: string (who did the work)
 *   notes?: string
 * }
 * ============================================================================
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: reminderId } = await params;
    const body = await request.json();

    // Validate reminder exists and fetch its details
    const [reminder] = await db
      .select({
        id: maintenanceReminders.id,
        title: maintenanceReminders.title,
        schedule: maintenanceReminders.schedule,
        customIntervalDays: maintenanceReminders.customIntervalDays,
      })
      .from(maintenanceReminders)
      .where(eq(maintenanceReminders.id, reminderId));

    if (!reminder) {
      return NextResponse.json(
        { error: 'Maintenance reminder not found' },
        { status: 404 }
      );
    }

    // Validate completion data
    const validation = validateRequest(completeMaintenanceSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { completedBy, cost, vendor, notes } = validation.data;
    const now = new Date();

    // Create completion record
    const [completion] = await db
      .insert(maintenanceCompletions)
      .values({
        reminderId,
        completedAt: now,
        completedBy: completedBy || null,
        cost: cost ? cost.toString() : null,
        vendor: vendor || null,
        notes: notes || null,
      })
      .returning();

    if (!completion) {
      return NextResponse.json(
        { error: 'Failed to create completion record' },
        { status: 500 }
      );
    }

    // Calculate next due date
    const nextDue = calculateNextDue(reminder.schedule, reminder.customIntervalDays);

    // Update reminder with lastCompleted and new nextDue
    await db
      .update(maintenanceReminders)
      .set({
        lastCompleted: now,
        nextDue,
        updatedAt: now,
      })
      .where(eq(maintenanceReminders.id, reminderId));

    return NextResponse.json({
      id: completion.id,
      reminderId: completion.reminderId,
      completedAt: completion.completedAt.toISOString(),
      completedBy: completion.completedBy,
      cost: completion.cost,
      vendor: completion.vendor,
      notes: completion.notes,
      nextDue,
      message: `Maintenance completed! Next due: ${nextDue}`,
    }, { status: 201 });
  } catch (error) {
    console.error('Error completing maintenance:', error);
    return NextResponse.json(
      { error: 'Failed to complete maintenance' },
      { status: 500 }
    );
  }
}
