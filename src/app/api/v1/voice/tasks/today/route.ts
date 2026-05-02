import { withAuth } from '@/lib/api/withAuth';
import { voiceOk, voiceError } from '@/lib/api/voiceResponse';
import { phraseTaskList } from '@/lib/api/voicePhrases';
import { db } from '@/lib/db/client';
import { tasks } from '@/lib/db/schema';
import { and, gte, lt, eq, asc } from 'drizzle-orm';
import { logError } from '@/lib/utils/logError';

/**
 * GET /api/v1/voice/tasks/today
 *
 * Returns incomplete tasks whose dueDate falls within today (server local time).
 */
export async function GET() {
  return withAuth(async () => {
    try {
      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dueToday = await db
        .select({
          id: tasks.id,
          title: tasks.title,
          dueDate: tasks.dueDate,
          priority: tasks.priority,
          assignedTo: tasks.assignedTo,
        })
        .from(tasks)
        .where(and(
          gte(tasks.dueDate, dayStart),
          lt(tasks.dueDate, dayEnd),
          eq(tasks.completed, false),
        ))
        .orderBy(asc(tasks.dueDate));

      const spoken = phraseTaskList(dueToday.map((t) => t.title));

      return voiceOk(spoken, {
        count: dueToday.length,
        tasks: dueToday.map((t) => ({
          id: t.id,
          title: t.title,
          dueDate: t.dueDate?.toISOString() ?? null,
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
