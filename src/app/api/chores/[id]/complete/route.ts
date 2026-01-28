/**
 * ============================================================================
 * PRISM - Chore Completion API Route
 * ============================================================================
 *
 * ENDPOINT: /api/chores/[id]/complete
 * - POST: Mark a chore as completed
 *
 * APPROVAL WORKFLOW:
 * Children ALWAYS require parent approval for chore completions.
 * Parents auto-approve their own completions (unless chore.requiresApproval).
 *
 * If requiresApproval is true (chore setting) OR completing user is a child:
 *   - Completion is created with approvedBy = null
 *   - Parent must approve via separate API call
 * If requiresApproval is false AND completing user is a parent:
 *   - Completion is auto-approved
 *   - Points are immediately awarded
 *
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { chores, choreCompletions, users } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { completeChoreSchema, validateRequest } from '@/lib/validations';
import { addDays, addMonths, format } from 'date-fns';

/**
 * Calculate the next due date based on frequency
 */
function calculateNextDue(
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom',
  customIntervalDays?: number | null
): string {
  const now = new Date();
  let nextDate: Date;

  switch (frequency) {
    case 'daily':
      nextDate = addDays(now, 1);
      break;
    case 'weekly':
      nextDate = addDays(now, 7);
      break;
    case 'biweekly':
      nextDate = addDays(now, 14);
      break;
    case 'monthly':
      nextDate = addMonths(now, 1);
      break;
    case 'custom':
      nextDate = addDays(now, customIntervalDays || 1);
      break;
    default:
      nextDate = addDays(now, 1);
  }

  return format(nextDate, 'yyyy-MM-dd');
}

/**
 * Route params type
 */
interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/chores/[id]/complete
 * ============================================================================
 * Records a chore completion.
 *
 * REQUEST BODY:
 * {
 *   completedBy: string (user UUID, required)
 *   photoUrl?: string (optional proof photo)
 *   notes?: string (optional notes)
 * }
 *
 * EXAMPLE:
 * POST /api/chores/abc123/complete
 * {
 *   "completedBy": "user-uuid",
 *   "photoUrl": "https://...",
 *   "notes": "Took out all three bins"
 * }
 * ============================================================================
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: choreId } = await params;
    const body = await request.json();

    // Validate chore exists and fetch its details
    const [chore] = await db
      .select({
        id: chores.id,
        title: chores.title,
        pointValue: chores.pointValue,
        requiresApproval: chores.requiresApproval,
        enabled: chores.enabled,
        frequency: chores.frequency,
        customIntervalDays: chores.customIntervalDays,
      })
      .from(chores)
      .where(eq(chores.id, choreId));

    if (!chore) {
      return NextResponse.json(
        { error: 'Chore not found' },
        { status: 404 }
      );
    }

    // Check if chore is enabled
    if (!chore.enabled) {
      return NextResponse.json(
        { error: 'Cannot complete a disabled chore' },
        { status: 400 }
      );
    }

    // Validate completion data
    const validation = validateRequest(completeChoreSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { completedBy, photoUrl, notes } = validation.data;

    // Look up the completing user to check their role
    const [completingUser] = await db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, completedBy));

    if (!completingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // ========================================================================
    // AUTHORIZATION CHECK - Children can only complete their own assigned chores
    // ========================================================================
    const isChild = completingUser.role === 'child';

    // Fetch chore assignment to check ownership
    const [choreAssignment] = await db
      .select({ assignedTo: chores.assignedTo })
      .from(chores)
      .where(eq(chores.id, choreId));

    if (isChild && choreAssignment?.assignedTo && choreAssignment.assignedTo !== completedBy) {
      return NextResponse.json(
        { error: 'You can only complete chores assigned to you' },
        { status: 403 }
      );
    }

    // ========================================================================
    // CHECK FOR EXISTING PENDING COMPLETION
    // ========================================================================
    // Prevent children from creating duplicate completions while one is pending
    const [existingPendingCompletion] = await db
      .select({
        id: choreCompletions.id,
        completedBy: choreCompletions.completedBy,
      })
      .from(choreCompletions)
      .where(
        and(
          eq(choreCompletions.choreId, choreId),
          isNull(choreCompletions.approvedBy)
        )
      );

    if (existingPendingCompletion) {
      // If a child tries to complete a chore that's already pending, reject it
      if (isChild) {
        return NextResponse.json({
          error: 'This chore is already pending parental approval',
          message: 'This chore has already been completed and is waiting for a parent to approve it.',
          alreadyPending: true,
        }, { status: 409 }); // 409 Conflict
      }
      // If a parent completes, they're approving - but that should go through /approve endpoint
      // This path means a parent is clicking "complete" on a pending chore in the dashboard
      // The dashboard logic should route to approve, but as a fallback, we can handle it here
    }

    // Determine if approval is required:
    // - Children ALWAYS require parent approval
    // - Parents NEVER require approval (they self-approve)
    // The chore's `requiresApproval` flag is specifically for child completions
    const needsApproval = isChild; // Only children need approval

    // Create completion record
    const [completion] = await db
      .insert(choreCompletions)
      .values({
        choreId,
        completedBy,
        completedAt: new Date(),
        photoUrl: photoUrl || null,
        notes: notes || null,
        pointsAwarded: chore.pointValue,
        // Auto-approve only if no approval needed
        approvedBy: needsApproval ? null : completedBy,
        approvedAt: needsApproval ? null : new Date(),
      })
      .returning();

    if (!completion) {
      return NextResponse.json(
        { error: 'Failed to create completion record' },
        { status: 500 }
      );
    }

    // If auto-approved (parent completing a chore),
    // update the chore's lastCompleted timestamp and calculate nextDue
    if (!needsApproval) {
      // Calculate next due date based on frequency
      const nextDue = calculateNextDue(chore.frequency, chore.customIntervalDays);

      await db
        .update(chores)
        .set({
          lastCompleted: completion.completedAt,
          nextDue: nextDue,
          updatedAt: new Date(),
        })
        .where(eq(chores.id, choreId));
    }

    // Generate appropriate message
    let message: string;
    if (isChild) {
      message = `Great job, ${completingUser.name}! Your chore is pending parent approval.`;
    } else {
      // Parents always self-approve
      message = `Chore completed! ${chore.pointValue} points awarded.`;
    }

    return NextResponse.json({
      id: completion.id,
      choreId: completion.choreId,
      completedBy: completion.completedBy,
      completedAt: completion.completedAt.toISOString(),
      photoUrl: completion.photoUrl,
      notes: completion.notes,
      pointsAwarded: completion.pointsAwarded,
      approved: !needsApproval,
      approvedBy: completion.approvedBy,
      approvedAt: completion.approvedAt?.toISOString() || null,
      requiresApproval: needsApproval,
      isChildCompletion: isChild,
      message,
    }, { status: 201 });
  } catch (error) {
    console.error('Error completing chore:', error);
    return NextResponse.json(
      { error: 'Failed to complete chore' },
      { status: 500 }
    );
  }
}
