import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { voiceOk, voiceError } from '@/lib/api/voiceResponse';
import { db } from '@/lib/db/client';
import { chores, users } from '@/lib/db/schema';
import { ilike, eq, and } from 'drizzle-orm';
import { voiceChoreCompleteSchema, validateRequest } from '@/lib/validations';
import { PERMISSIONS } from '@/types/user';
import {
  approverForNewCompletion,
  findPendingCompletion,
  recordChoreCompletion,
} from '@/lib/services/choreCompletion';
import { logError } from '@/lib/utils/logError';

/**
 * POST /api/v1/voice/chore/complete
 *
 * Body: { chore, assignee? }
 *
 * Behaviour (locked in `docs/voice-api.md`):
 * - Fuzzy-matches chore by name (case-insensitive substring on title).
 * - If multiple matches exist across distinct assignees and no `assignee`
 *   is supplied, returns ok:false with a disambiguation prompt + candidates.
 * - completedBy ALWAYS inherits from chore.assignedTo: voice cannot
 *   claim someone else's points.
 * - Approval follows the app's rule (src/lib/services/choreCompletion.ts)
 *   with the assignee as the person acting, since the speaker is not
 *   identified and the completion is recorded as theirs. A child's
 *   completion is pending, as it is when a child completes in the app, and a
 *   second one is refused while one is pending. A parent's completion is
 *   approved by that parent, as it is in the app.
 * - Voice never approves a chore flagged requiresApproval: the speaker cannot
 *   be verified, so that completion is pending even for a parent.
 */
export async function POST(request: NextRequest) {
  return withAuth(async (auth) => {
    try {
      const body = await request.json().catch(() => ({}));
      const validation = validateRequest(voiceChoreCompleteSchema, body);
      if (!validation.success) {
        return voiceError("I didn't catch which chore. Please try again.", 400);
      }

      const { chore: choreName, assignee } = validation.data;

      // Fuzzy match chores by title, joined with assignee info for disambiguation
      const matches = await db
        .select({
          id: chores.id,
          title: chores.title,
          assignedTo: chores.assignedTo,
          assigneeName: users.name,
          assigneeRole: users.role,
          requiresApproval: chores.requiresApproval,
          pointValue: chores.pointValue,
          frequency: chores.frequency,
          customIntervalDays: chores.customIntervalDays,
          startDay: chores.startDay,
          enabled: chores.enabled,
        })
        .from(chores)
        .leftJoin(users, eq(users.id, chores.assignedTo))
        .where(and(
          ilike(chores.title, `%${choreName}%`),
          eq(chores.enabled, true),
        ));

      if (matches.length === 0) {
        return voiceError(`I couldn't find a chore matching '${choreName}'.`, 404);
      }

      // If assignee provided, narrow down
      let candidates = matches;
      if (assignee) {
        candidates = matches.filter(
          (c) => c.assigneeName && c.assigneeName.toLowerCase().includes(assignee.toLowerCase())
        );
        if (candidates.length === 0) {
          return voiceError(
            `I couldn't find a chore matching '${choreName}' assigned to ${assignee}.`,
            404,
          );
        }
      }

      // Disambiguation: multiple candidates with distinct assignees
      const distinctAssignees = new Set(candidates.map((c) => c.assignedTo).filter(Boolean));
      if (candidates.length > 1 && distinctAssignees.size > 1) {
        const names = candidates
          .map((c) => c.assigneeName)
          .filter((n): n is string => Boolean(n));
        // ok:false (action didn't complete) but HTTP 200 (request was
        // well-formed; we just need a follow-up). Caller branches on
        // `data.ambiguous` and resends with `assignee`.
        return NextResponse.json({
          ok: false,
          spoken: `Multiple chores match '${choreName}'. Which family member: ${names.join(', ')}?`,
          data: {
            ambiguous: true,
            candidates: candidates.map((c) => ({
              choreId: c.id,
              title: c.title,
              assigneeId: c.assignedTo,
              assigneeName: c.assigneeName,
            })),
          },
        });
      }

      const target = candidates[0]!;

      if (!target.assignedTo) {
        return voiceError(
          `That chore isn't assigned to anyone, so I can't mark it complete.`,
          400,
        );
      }

      const assigneeId = target.assignedTo;
      const assigneeCanApprove =
        target.assigneeRole !== null && PERMISSIONS[target.assigneeRole].canApproveChores;

      // Same guard as the app: a child cannot stack a second completion on
      // one that is still waiting for a parent.
      if (target.assigneeRole === 'child' && (await findPendingCompletion(target.id))) {
        return voiceError(
          `${target.title} is already waiting for a parent to approve it in the app.`,
          409,
        );
      }

      const approvedBy = approverForNewCompletion({
        userId: assigneeId,
        canApprove: assigneeCanApprove && !target.requiresApproval,
      });
      const isPending = approvedBy === null;

      const completion = await recordChoreCompletion({
        chore: target,
        completedBy: assigneeId,
        approvedBy,
        actorUserId: auth.userId,
      });

      const spoken = isPending
        ? `Marked ${target.title} complete. A parent will need to approve in the app.`
        : `Marked ${target.title} complete.`;

      return voiceOk(spoken, {
        choreId: target.id,
        completionId: completion.id,
        completedBy: assigneeId,
        pending: isPending,
      });
    } catch (error) {
      logError('Voice API: chore/complete failed', error);
      return voiceError('Sorry, I had trouble marking that chore complete.', 500);
    }
  }, {
    tokenScope: 'voice',
    rateLimit: { feature: 'voice-api', limit: 60, windowSeconds: 60 },
  });
}
