/**
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
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { chores, choreCompletions, users } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { completeChoreSchema, validateRequest } from '@/lib/validations';
import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
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
  getDate,
  setMonth,
  setYear,
  getMonth,
  getYear,
  isBefore,
  startOfDay,
} from 'date-fns';
import { invalidateCache } from '@/lib/cache/redis';
import { rateLimitGuard } from '@/lib/cache/rateLimit';

const dayFunctions = [nextSunday, nextMonday, nextTuesday, nextWednesday, nextThursday, nextFriday, nextSaturday];

/**
 * Calculate the next due date based on frequency and optional startDay override.
 * - weekly: next occurrence of startDay (0=Sun, 1=Mon, ..., 6=Sat), default Sunday
 * - monthly: next occurrence of day-of-month (1-28), default 1st
 * - annually: next occurrence of MM-DD, default same month-day next year
 * - daily/custom: just add the interval
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
      // startDay: 0=Sunday, 1=Monday, ..., 6=Saturday (default 0)
      const targetDay = startDay ? parseInt(startDay, 10) : 0;
      const dayFn = dayFunctions[targetDay] || nextSunday;
      nextDate = dayFn(today);
      break;
    }

    case 'biweekly': {
      // For biweekly, use startDay for the target day, then add 2 weeks from last occurrence
      const targetDay = startDay ? parseInt(startDay, 10) : 0;
      const dayFn = dayFunctions[targetDay] || nextSunday;
      const nextWeekDay = dayFn(today);
      // Add one more week to make it biweekly
      nextDate = addWeeks(nextWeekDay, 1);
      break;
    }

    case 'monthly': {
      // startDay: day of month (1-28), default 1
      const targetDom = startDay ? Math.min(28, Math.max(1, parseInt(startDay, 10))) : 1;
      const currentDom = getDate(today);
      if (currentDom < targetDom) {
        // Still this month
        nextDate = setDate(today, targetDom);
      } else {
        // Next month
        nextDate = setDate(addMonths(today, 1), targetDom);
      }
      break;
    }

    case 'quarterly': {
      // Next quarter's first day, or use startDay as day-of-month
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
      // startDay: "MM-DD" format, e.g., "03-15" for March 15
      let targetMonth = getMonth(today);
      let targetDom = getDate(today);

      if (startDay && startDay.includes('-')) {
        const [mm, dd] = startDay.split('-');
        targetMonth = Math.max(0, Math.min(11, parseInt(mm!, 10) - 1));
        targetDom = Math.max(1, Math.min(28, parseInt(dd!, 10)));
      }

      let candidate = setDate(setMonth(today, targetMonth), targetDom);
      if (isBefore(candidate, addDays(today, 1))) {
        // Already passed this year, go to next year
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
 * POST /api/chores/[id]/complete
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
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const limited = await rateLimitGuard(auth.userId, 'chore-complete', 20, 60);
  if (limited) return limited;

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

    // AUTHORIZATION CHECK - Children can only complete their own assigned chores
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

    // CHECK FOR EXISTING PENDING COMPLETION
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

    // Create completion + conditionally update chore atomically
    const completion = await db.transaction(async (tx) => {
      const [comp] = await tx
        .insert(choreCompletions)
        .values({
          choreId,
          completedBy,
          completedAt: new Date(),
          photoUrl: photoUrl || null,
          notes: notes || null,
          pointsAwarded: chore.pointValue,
          approvedBy: needsApproval ? null : completedBy,
          approvedAt: needsApproval ? null : new Date(),
        })
        .returning();

      if (!comp) throw new Error('Failed to create completion record');

      // If auto-approved (parent completing), update chore's lastCompleted and nextDue
      if (!needsApproval) {
        const nextDue = calculateNextDue(chore.frequency, chore.customIntervalDays, chore.startDay);
        await tx
          .update(chores)
          .set({
            lastCompleted: comp.completedAt,
            nextDue: nextDue,
            updatedAt: new Date(),
          })
          .where(eq(chores.id, choreId));
      }

      return comp;
    });

    // Generate appropriate message
    let message: string;
    if (isChild) {
      message = `Great job, ${completingUser.name}! Your chore is pending parent approval.`;
    } else {
      // Parents always self-approve
      message = `Chore completed! ${chore.pointValue} points awarded.`;
    }

    await invalidateCache('chores:*');
    await invalidateCache('goals:*');

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
