/**
 * ============================================================================
 * PRISM - Chore Approval API Route
 * ============================================================================
 *
 * ENDPOINT: /api/chores/[id]/approve
 * - POST: Approve a pending chore completion (parent only)
 *
 * This endpoint allows parents to approve chore completions that are
 * pending approval. Only users with the 'parent' role can approve.
 *
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { chores, choreCompletions, users } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/auth/session';
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
 * POST /api/chores/[id]/approve
 * ============================================================================
 * Approves a pending chore completion.
 *
 * AUTHORIZATION:
 * Only parents can approve chore completions.
 *
 * REQUEST BODY:
 * {
 *   completionId?: string (optional - if not provided, approves the most recent pending completion)
 * }
 *
 * RESPONSE:
 * - 200: Completion approved successfully
 * - 401: Not authenticated
 * - 403: Not authorized (not a parent)
 * - 404: Chore not found or no pending completion
 * - 500: Server error
 * ============================================================================
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: choreId } = await params;

    // Parse request body (optional)
    let completionId: string | undefined;
    try {
      const body = await request.json();
      completionId = body.completionId;
    } catch {
      // Body is optional, ignore parse errors
    }

    // ========================================================================
    // AUTHENTICATION CHECK
    // ========================================================================
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('prism_session')?.value;
    const userId = cookieStore.get('prism_user')?.value;

    if (!sessionToken || !userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Validate session token
    const sessionData = await validateSession(sessionToken);
    if (!sessionData || sessionData.userId !== userId) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    // Fetch the current user to check their role
    const [currentUser] = await db
      .select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .where(eq(users.id, userId));

    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    // ========================================================================
    // AUTHORIZATION CHECK - Only parents can approve
    // ========================================================================
    if (currentUser.role !== 'parent') {
      return NextResponse.json(
        { error: 'Only parents can approve chore completions' },
        { status: 403 }
      );
    }

    // ========================================================================
    // VERIFY CHORE EXISTS
    // ========================================================================
    const [chore] = await db
      .select({
        id: chores.id,
        title: chores.title,
        pointValue: chores.pointValue,
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

    // ========================================================================
    // FIND PENDING COMPLETION
    // ========================================================================
    let pendingCompletionQuery = db
      .select({
        id: choreCompletions.id,
        choreId: choreCompletions.choreId,
        completedBy: choreCompletions.completedBy,
        completedAt: choreCompletions.completedAt,
        pointsAwarded: choreCompletions.pointsAwarded,
      })
      .from(choreCompletions)
      .where(
        and(
          eq(choreCompletions.choreId, choreId),
          isNull(choreCompletions.approvedBy)
        )
      );

    // If a specific completion ID was provided, filter by it
    if (completionId) {
      pendingCompletionQuery = db
        .select({
          id: choreCompletions.id,
          choreId: choreCompletions.choreId,
          completedBy: choreCompletions.completedBy,
          completedAt: choreCompletions.completedAt,
          pointsAwarded: choreCompletions.pointsAwarded,
        })
        .from(choreCompletions)
        .where(
          and(
            eq(choreCompletions.id, completionId),
            eq(choreCompletions.choreId, choreId),
            isNull(choreCompletions.approvedBy)
          )
        );
    }

    const [pendingCompletion] = await pendingCompletionQuery;

    if (!pendingCompletion) {
      return NextResponse.json(
        { error: 'No pending completion found for this chore' },
        { status: 404 }
      );
    }

    // ========================================================================
    // APPROVE THE COMPLETION
    // ========================================================================
    const now = new Date();

    await db
      .update(choreCompletions)
      .set({
        approvedBy: userId,
        approvedAt: now,
      })
      .where(eq(choreCompletions.id, pendingCompletion.id));

    // Update the chore's lastCompleted timestamp and calculate nextDue
    const nextDue = calculateNextDue(chore.frequency, chore.customIntervalDays);

    await db
      .update(chores)
      .set({
        lastCompleted: pendingCompletion.completedAt,
        nextDue: nextDue,
        updatedAt: now,
      })
      .where(eq(chores.id, choreId));

    // Fetch the completing user's name for the response
    const [completingUser] = await db
      .select({ name: users.name, color: users.color })
      .from(users)
      .where(eq(users.id, pendingCompletion.completedBy));

    return NextResponse.json({
      message: `Chore "${chore.title}" approved!`,
      completion: {
        id: pendingCompletion.id,
        choreId: pendingCompletion.choreId,
        choreTitle: chore.title,
        completedBy: {
          id: pendingCompletion.completedBy,
          name: completingUser?.name || 'Unknown',
          color: completingUser?.color || '#888888',
        },
        completedAt: pendingCompletion.completedAt.toISOString(),
        approvedBy: {
          id: currentUser.id,
          name: currentUser.name,
        },
        approvedAt: now.toISOString(),
        pointsAwarded: pendingCompletion.pointsAwarded,
      },
    });
  } catch (error) {
    console.error('Error approving chore:', error);
    return NextResponse.json(
      { error: 'Failed to approve chore' },
      { status: 500 }
    );
  }
}
