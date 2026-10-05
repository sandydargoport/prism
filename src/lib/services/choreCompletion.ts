/**
 * Recording a chore completion, shared by every path that creates one: the
 * app's complete route and the voice API.
 *
 * APPROVAL RULE:
 * A completion is approved at the moment it is recorded, with the person
 * acting recorded as the approver, when that person can approve chores or the
 * chore is not flagged requiresApproval. A completion of a flagged chore by
 * anyone else is created pending and waits for a parent on
 * POST /api/chores/[id]/approve.
 *
 * Points are always recorded on the completion (`pointsAwarded`), approved or
 * not. Points and goal totals count only approved completions, so a pending
 * completion adds nothing until it is approved, and approving it keeps the
 * points it was recorded with.
 */

import { db } from '@/lib/db/client';
import { chores, choreCompletions } from '@/lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { requireRole, type AuthResult } from '@/lib/auth';
import { calculateNextDue, type ChoreFrequency } from '@/lib/utils/calculateNextDue';
import { getHouseholdTimezone } from '@/lib/householdTimezone';
import { todayKey } from '@/lib/utils/zonedDate';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logActivity } from '@/lib/services/auditLog';

/** The chore fields a completion needs. */
export type CompletableChore = {
  id: string;
  title: string;
  pointValue: number;
  frequency: ChoreFrequency;
  customIntervalDays: number | null;
  startDay: string | null;
};

/**
 * Whether an authenticated caller can approve chores. This is the same check
 * the approve route makes, so a caller self-approves on completion exactly
 * when it could approve afterwards. API tokens are judged by their scopes, not
 * the 'parent' role every token carries: a voice-scoped token cannot approve.
 */
export function callerCanApproveChores(auth: AuthResult): boolean {
  return requireRole(auth, 'canApproveChores') === null;
}

/**
 * The approver for a new completion: the actor when they can approve chores
 * or the chore does not require approval, otherwise null (pending).
 */
export function approverForNewCompletion(actor: {
  userId: string;
  canApprove: boolean;
  requiresApproval: boolean;
}): string | null {
  return actor.canApprove || !actor.requiresApproval ? actor.userId : null;
}

/** A pending (unapproved) completion for a chore, if there is one. */
export async function findPendingCompletion(
  choreId: string,
): Promise<{ id: string; completedBy: string } | undefined> {
  const [pending] = await db
    .select({ id: choreCompletions.id, completedBy: choreCompletions.completedBy })
    .from(choreCompletions)
    .where(and(eq(choreCompletions.choreId, choreId), isNull(choreCompletions.approvedBy)));
  return pending;
}

/**
 * Insert a completion and, when it is approved, move the chore's schedule on
 * from the household's today. Invalidates the chore caches and writes the
 * audit entry.
 */
export async function recordChoreCompletion(params: {
  chore: CompletableChore;
  completedBy: string;
  /** From approverForNewCompletion(); null creates a pending completion. */
  approvedBy: string | null;
  /** The authenticated user, for the audit log. */
  actorUserId: string;
  photoUrl?: string | null;
  notes?: string | null;
}) {
  const { chore, completedBy, approvedBy, actorUserId } = params;
  const approved = approvedBy !== null;
  const now = new Date();
  const today = todayKey(await getHouseholdTimezone());

  const completion = await db.transaction(async (tx) => {
    const [comp] = await tx
      .insert(choreCompletions)
      .values({
        choreId: chore.id,
        completedBy,
        completedAt: now,
        photoUrl: params.photoUrl || null,
        notes: params.notes || null,
        pointsAwarded: chore.pointValue,
        approvedBy,
        approvedAt: approved ? now : null,
      })
      .returning();

    if (!comp) throw new Error('Failed to create completion record');

    // A pending completion leaves the schedule alone; the approve route moves
    // it on when a parent approves.
    if (approved) {
      await tx
        .update(chores)
        .set({
          lastCompleted: comp.completedAt,
          nextDue: calculateNextDue(chore.frequency, chore.customIntervalDays, chore.startDay, today),
          updatedAt: now,
        })
        .where(eq(chores.id, chore.id));
    }

    return comp;
  });

  await invalidateEntity('chores');

  logActivity({
    userId: actorUserId,
    action: 'complete',
    entityType: 'chore',
    entityId: chore.id,
    summary: `Completed chore: ${chore.title}`,
  });

  return completion;
}
