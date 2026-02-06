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
import { requireAuth, requireRole } from '@/lib/auth';
import {
  addDays,
  addWeeks,
  addMonths,
  format,
  nextSunday,
  nextMonday,
  nextTuesday,
  nextWednesday,
  nextThursday,
  nextFriday,
  nextSaturday,
  startOfMonth,
  setDate,
  setMonth,
  setYear,
  getDate,
  getMonth,
  getYear,
  isBefore,
  startOfDay,
} from 'date-fns';
import { invalidateCache } from '@/lib/cache/redis';

const dayFunctions = [nextSunday, nextMonday, nextTuesday, nextWednesday, nextThursday, nextFriday, nextSaturday];

/**
 * Calculate the next due date based on frequency and optional startDay override.
 */
function calculateNextDue(
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'semi-annually' | 'annually' | 'custom',
  customIntervalDays?: number | null,
  startDay?: string | null
): string {
  const now = new Date();
  const today = startOfDay(now);
  let nextDate: Date;

  switch (frequency) {
    case 'daily':
      nextDate = addDays(today, 1);
      break;
    case 'weekly': {
      const targetDay = startDay ? parseInt(startDay, 10) : 0;
      const dayFn = dayFunctions[targetDay] || nextSunday;
      nextDate = dayFn(today);
      break;
    }
    case 'biweekly': {
      const targetDay = startDay ? parseInt(startDay, 10) : 0;
      const dayFn = dayFunctions[targetDay] || nextSunday;
      const nextWeekDay = dayFn(today);
      nextDate = addWeeks(nextWeekDay, 1);
      break;
    }
    case 'monthly': {
      const targetDom = startDay ? Math.min(28, Math.max(1, parseInt(startDay, 10))) : 1;
      const currentDom = getDate(today);
      if (currentDom < targetDom) {
        nextDate = setDate(today, targetDom);
      } else {
        nextDate = setDate(addMonths(today, 1), targetDom);
      }
      break;
    }
    case 'quarterly': {
      const targetDom = startDay ? Math.min(28, Math.max(1, parseInt(startDay, 10))) : 1;
      const nextQ = addMonths(startOfMonth(today), 3);
      nextDate = setDate(nextQ, targetDom);
      break;
    }
    case 'semi-annually': {
      const targetDom = startDay ? Math.min(28, Math.max(1, parseInt(startDay, 10))) : 1;
      const next6 = addMonths(startOfMonth(today), 6);
      nextDate = setDate(next6, targetDom);
      break;
    }
    case 'annually': {
      let targetMonth = getMonth(today);
      let targetDom = getDate(today);
      if (startDay && startDay.includes('-')) {
        const [mm, dd] = startDay.split('-');
        targetMonth = Math.max(0, Math.min(11, parseInt(mm!, 10) - 1));
        targetDom = Math.max(1, Math.min(28, parseInt(dd!, 10)));
      }
      let candidate = setDate(setMonth(today, targetMonth), targetDom);
      if (isBefore(candidate, addDays(today, 1))) {
        candidate = setYear(candidate, getYear(today) + 1);
      }
      nextDate = candidate;
      break;
    }
    case 'custom':
      nextDate = addDays(today, customIntervalDays || 1);
      break;
    default:
      nextDate = addDays(today, 1);
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
    // AUTHENTICATION & AUTHORIZATION CHECK
    // ========================================================================
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const forbidden = requireRole(auth, 'canApproveChores');
    if (forbidden) return forbidden;

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
        startDay: chores.startDay,
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

    // Approve completion + update chore atomically
    const now = new Date();
    const nextDue = calculateNextDue(chore.frequency, chore.customIntervalDays, chore.startDay);

    await db.transaction(async (tx) => {
      await tx
        .update(choreCompletions)
        .set({
          approvedBy: auth.userId,
          approvedAt: now,
        })
        .where(eq(choreCompletions.id, pendingCompletion.id));

      await tx
        .update(chores)
        .set({
          lastCompleted: pendingCompletion.completedAt,
          nextDue: nextDue,
          updatedAt: now,
        })
        .where(eq(chores.id, choreId));
    });

    // Fetch the completing user and approving user names for the response
    const [completingUser] = await db
      .select({ name: users.name, color: users.color })
      .from(users)
      .where(eq(users.id, pendingCompletion.completedBy));

    const [approvingUser] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, auth.userId));

    await invalidateCache('chores:*');
    await invalidateCache('goals:*');

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
          id: auth.userId,
          name: approvingUser?.name || 'Unknown',
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
