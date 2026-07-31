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
import { requireAuth, requireRole } from '@/lib/auth';
import { PERMISSIONS } from '@/types/user';
import { db } from '@/lib/db/client';
import { chores, choreCompletions, users } from '@/lib/db/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { completeChoreSchema, validateRequest } from '@/lib/validations';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { rateLimitGuard } from '@/lib/cache/rateLimit';
import { calculateNextDue } from '@/lib/utils/calculateNextDue';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';

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

    // Determine if approval is required based on the AUTHENTICATED caller, not
    // the client-supplied completedBy. Otherwise a child could pass a parent's
    // id to make needsApproval=false and auto-approve their own completion,
    // bypassing parental approval. Only callers who can approve chores (parents)
    // self-approve; everyone else's completion is created pending.
    const callerCanApprove = PERMISSIONS[auth.role].canApproveChores;
    const needsApproval = !callerCanApprove;

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
          approvedBy: needsApproval ? null : auth.userId,
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

    await invalidateEntity('chores');

    logActivity({
      userId: auth.userId,
      action: 'complete',
      entityType: 'chore',
      entityId: choreId,
      summary: `Completed chore: ${chore.title}`,
    });

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
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  // Undoing a completion reverses an approval — parent-only.
  const forbidden = requireRole(auth, 'canApproveChores');
  if (forbidden) return forbidden;

  try {
    const { id: choreId } = await params;

    // Find the most recent completion
    const [latest] = await db
      .select({ id: choreCompletions.id })
      .from(choreCompletions)
      .where(eq(choreCompletions.choreId, choreId))
      .orderBy(desc(choreCompletions.completedAt))
      .limit(1);

    if (!latest) {
      return NextResponse.json({ error: 'No completion to undo' }, { status: 404 });
    }

    // Undo the completion, then rebuild the chore's schedule fields from
    // whichever completion (if any) is now the most recent.
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
              ? calculateNextDue(chore.frequency, chore.customIntervalDays, chore.startDay)
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
