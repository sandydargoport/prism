import { withAuth } from '@/lib/api/withAuth';
import { voiceOk, voiceError } from '@/lib/api/voiceResponse';
import { phraseTaskList } from '@/lib/api/voicePhrases';
import { db } from '@/lib/db/client';
import { tasks } from '@/lib/db/schema';
import { and, eq, asc } from 'drizzle-orm';
import { logError } from '@/lib/utils/logError';
import { getHouseholdTimezone } from '@/lib/householdTimezone';
import { todayKey } from '@/lib/utils/zonedDate';

/**
 * GET /api/v1/voice/tasks/today
 *
 * Returns incomplete tasks due today in the household time zone.
 */
export async function GET() {
  return withAuth(async () => {
    try {
      const today = todayKey(await getHouseholdTimezone());

      const dueToday = await db
        .select({
          id: tasks.id,
          title: tasks.title,
          dueDate: tasks.dueDate,
          dueTime: tasks.dueTime,
          priority: tasks.priority,
          assignedTo: tasks.assignedTo,
        })
        .from(tasks)
        .where(and(
          eq(tasks.dueDate, today),
          eq(tasks.completed, false),
        ))
        .orderBy(asc(tasks.dueTime), asc(tasks.title));

      const spoken = phraseTaskList(dueToday.map((t) => t.title));

      return voiceOk(spoken, {
        count: dueToday.length,
        tasks: dueToday.map((t) => ({
          id: t.id,
          title: t.title,
          dueDate: t.dueDate,
          dueTime: t.dueTime,
          priority: t.priority,
          assignedTo: t.assignedTo,
        })),
      });
    } catch (error) {
      logError('Voice API: tasks/today failed', error);
      return voiceError('Sorry, I had trouble reading your tasks.', 500);
    }
  }, {
    tokenScope: 'voice',
    rateLimit: { feature: 'voice-api', limit: 60, windowSeconds: 60 },
  });
}
