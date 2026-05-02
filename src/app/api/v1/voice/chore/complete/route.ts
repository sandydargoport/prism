import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { voiceOk, voiceError } from '@/lib/api/voiceResponse';
import { db } from '@/lib/db/client';
import { chores, choreCompletions, users } from '@/lib/db/schema';
import { ilike, eq, and } from 'drizzle-orm';
import { voiceChoreCompleteSchema, validateRequest } from '@/lib/validations';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
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
 * - completedBy ALWAYS inherits from chore.assignedTo — voice cannot
 *   claim someone else's points.
 * - If chore.requiresApproval, the completion is created pending
 *   (no approvedBy/approvedAt). Voice can never approve.
 */
export async function POST(request: NextRequest) {
  return withAuth(async () => {
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
          requiresApproval: chores.requiresApproval,
          pointValue: chores.pointValue,
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

      const isPending = target.requiresApproval;

      const [completion] = await db
        .insert(choreCompletions)
        .values({
          choreId: target.id,
          completedBy: target.assignedTo,
          pointsAwarded: isPending ? null : target.pointValue,
        })
        .returning();

      await invalidateEntity('chores');

      const spoken = isPending
        ? `Marked ${target.title} complete. A parent will need to approve in the app.`
        : `Marked ${target.title} complete.`;

      return voiceOk(spoken, {
        choreId: target.id,
        completionId: completion!.id,
        completedBy: target.assignedTo,
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
