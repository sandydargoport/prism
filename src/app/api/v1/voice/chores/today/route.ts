import { type NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { voiceOk, voiceError } from '@/lib/api/voiceResponse';
import { phraseTodayChores } from '@/lib/api/voicePhrases';
import { db } from '@/lib/db/client';
import { chores, users } from '@/lib/db/schema';
import { and, eq, lte, isNull, or, ilike } from 'drizzle-orm';
import { logError } from '@/lib/utils/logError';
import { getHouseholdTimezone } from '@/lib/householdTimezone';
import { todayKey } from '@/lib/utils/zonedDate';

/**
 * GET /api/v1/voice/chores/today?assignee=Emma
 *
 * Returns enabled chores due today or overdue, in the household time zone. When `assignee` is given,
 * only chores assigned to that family member (case-insensitive name match)
 * are returned, plus chores with no assignee (anyone-can-do).
 */
export async function GET(request: NextRequest) {
  return withAuth(async () => {
    try {
      const url = new URL(request.url);
      const assignee = url.searchParams.get('assignee')?.trim();
      const today = todayKey(await getHouseholdTimezone());

      // Resolve the assignee name to a user id when present.
      let assigneeId: string | null = null;
      let assigneeName: string | null = null;
      if (assignee) {
        const [match] = await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(ilike(users.name, assignee))
          .limit(1);
        if (match) {
          assigneeId = match.id;
          assigneeName = match.name;
        } else {
          return voiceOk(
            `I don't see anyone named ${assignee} in the family.`,
            { count: 0, chores: [] },
          );
        }
      }

      const conditions = [eq(chores.enabled, true), lte(chores.nextDue, today)];
      if (assigneeId) {
        conditions.push(or(eq(chores.assignedTo, assigneeId), isNull(chores.assignedTo))!);
      }

      const rows = await db
        .select({
          id: chores.id,
          title: chores.title,
          assignedTo: chores.assignedTo,
          nextDue: chores.nextDue,
          pointValue: chores.pointValue,
        })
        .from(chores)
        .where(and(...conditions));

      const spoken = phraseTodayChores(rows.map((r) => r.title), assigneeName);

      return voiceOk(spoken, {
        count: rows.length,
        chores: rows,
        assigneeName,
      });
    } catch (error) {
      logError('Voice API: chores/today failed', error);
      return voiceError('Sorry, I had trouble reading the chore list.', 500);
    }
  }, {
    tokenScope: 'voice',
    rateLimit: { feature: 'voice-api', limit: 60, windowSeconds: 60 },
  });
}
