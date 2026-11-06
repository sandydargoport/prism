/**
 *
 * ENDPOINT: /api/chores/[id]/complete
 * - POST: Mark a chore as completed
 *
 * APPROVAL WORKFLOW (src/lib/services/choreCompletion.ts):
 * The completion is auto-approved, with the caller as approver, when the
 * authenticated caller can approve chores (a parent session, or an API token
 * with the '*' scope) or the chore is not flagged requiresApproval. Otherwise
 * it is created pending (approvedBy = null) and a parent approves it via
 * POST /api/chores/[id]/approve.
 *
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { requireEverydayAuth, logWallChange } from '@/lib/auth/everydayAuth';
import { db } from '@/lib/db/client';
import { chores, choreCompletions, users } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { completeChoreSchema, validateRequest } from '@/lib/validations';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { rateLimitGuard } from '@/lib/cache/rateLimit';
import { calculateNextDue } from '@/lib/utils/calculateNextDue';
import { getHouseholdTimezone } from '@/lib/householdTimezone';
import { todayKey } from '@/lib/utils/zonedDate';
import { choreNotDueYet,
  approverForNewCompletion,
  callerCanApproveChores,
  findPendingCompletion,
  recordChoreCompletion,
} from '@/lib/services/choreCompletion';
import { logError } from '@/lib/utils/logError';
import { memberOrder } from '@/lib/db/memberOrder';

/**
 * Route params type
 */
/** How long the wall's Undo can take back a tick (#835). */
const WALL_UNDO_MS = 2 * 60_000;

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
  // A signed-out wall may tick a chore when the PIN setting is off (#835).
  const auth = await requireEverydayAuth('chore-complete');
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
        nextDue: chores.nextDue,
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

    // Done for this period already (#984): another tick would award the
    // points again and push the next due date further on.
    if (choreNotDueYet(chore.nextDue, todayKey(await getHouseholdTimezone()))) {
      return NextResponse.json({
        error: 'This chore is already done',
        message: `${chore.title} is done until ${chore.nextDue}.`,
        notDueUntil: chore.nextDue,
      }, { status: 409 });
    }

    if (auth.wall) await logWallChange('chore-complete', 'chore', choreId, `Ticked "${chore.title}" on the wall without a PIN`);

    // Validate completion data
    const validation = validateRequest(completeChoreSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { photoUrl, notes } = validation.data;
    let completedBy = validation.data.completedBy;
    if (!completedBy && validation.data.completedByIndex !== undefined) {
      // The same ordering the PIN pad and sign-in use (memberOrder).
      const members = await db.select({ id: users.id }).from(users).orderBy(...memberOrder);
      completedBy = members[validation.data.completedByIndex]?.id;
    }
    if (!completedBy) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

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
    const existingPendingCompletion = await findPendingCompletion(choreId);

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

    // Determine if approval is required based on the AUTHENTICATED caller, not
    // the client-supplied completedBy. Otherwise a child could pass a parent's
    // id to make needsApproval=false and auto-approve their own completion,
    // bypassing parental approval. Callers who can approve chores (parents,
    // and API tokens scoped to approve) self-approve, and so does anyone
    // completing a chore not flagged requiresApproval; everyone else's
    // completion is created pending. See src/lib/services/choreCompletion.ts.
    const approvedBy = approverForNewCompletion({
      userId: auth.userId,
      canApprove: callerCanApproveChores(auth),
      requiresApproval: chore.requiresApproval,
    });
    const needsApproval = approvedBy === null;

    const completion = await recordChoreCompletion({
      chore,
      completedBy,
      approvedBy,
      actorUserId: auth.userId,
      photoUrl,
      notes,
    });

    // Generate appropriate message
    let message: string;
    if (needsApproval) {
      message = `Great job, ${completingUser.name}! Your chore is pending parent approval.`;
    } else {
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
    logError('Error completing chore:', error);
    return NextResponse.json(
      { error: 'Failed to complete chore' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chores/[id]/complete
 * Undo the most recent completion for a chore (parent-only).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireEverydayAuth('chore-undo');
  if (auth instanceof NextResponse) return auth;

  // Undoing a completion reverses an approval: parent-only, except that the
  // wall may take back its own tick from the last two minutes (the toast's
  // Undo, #835).
  const forbidden = auth.wall ? null : requireRole(auth, 'canApproveChores');
  if (forbidden) return forbidden;

  try {
    const { id: choreId } = await params;

    // Find the most recent completion
    const [latest] = await db
      .select({ id: choreCompletions.id, completedAt: choreCompletions.completedAt })
      .from(choreCompletions)
      .where(eq(choreCompletions.choreId, choreId))
      .orderBy(desc(choreCompletions.completedAt))
      .limit(1);

    if (!latest) {
      return NextResponse.json({ error: 'No completion to undo' }, { status: 404 });
    }
    if (auth.wall && Date.now() - new Date(latest.completedAt).getTime() > WALL_UNDO_MS) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (auth.wall) await logWallChange('chore-undo', 'chore', choreId, 'Undid a tick on the wall without a PIN');

    // Undo the completion, then rebuild the chore's schedule fields from
    // whichever completion (if any) is now the most recent.
    const today = todayKey(await getHouseholdTimezone());
    await db.transaction(async (tx) => {
      await tx.delete(choreCompletions).where(eq(choreCompletions.id, latest.id));

      const remaining = await tx
        .select({ completedAt: choreCompletions.completedAt })
        .from(choreCompletions)
        .where(eq(choreCompletions.choreId, choreId))
        .orderBy(desc(choreCompletions.completedAt))
        .limit(1);
      const mostRecent = remaining[0];

      const [chore] = await tx.select().from(chores).where(eq(chores.id, choreId));

      await tx
        .update(chores)
        .set({
          lastCompleted: mostRecent?.completedAt ?? null,
          nextDue:
            mostRecent && chore
              ? calculateNextDue(chore.frequency, chore.customIntervalDays, chore.startDay, today)
              : null,
          updatedAt: new Date(),
        })
        .where(eq(chores.id, choreId));
    });

    await invalidateEntity('chores');

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Error undoing chore completion:', error);
    return NextResponse.json({ error: 'Failed to undo completion' }, { status: 500 });
  }
}
