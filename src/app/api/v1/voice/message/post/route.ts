import { type NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { voiceOk, voiceError } from '@/lib/api/voiceResponse';
import { db } from '@/lib/db/client';
import { familyMessages, users } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { voiceMessagePostSchema, validateRequest } from '@/lib/validations';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logError } from '@/lib/utils/logError';

/**
 * POST /api/v1/voice/message/post
 *
 * Body: { message }
 *
 * Author defaults to the first parent (by sortOrder). Voice has no way
 * to verify which family member is speaking — attributing posts to a
 * designated parent keeps the audit trail honest. A future `voiceUser`
 * setting could let the household pick a different default.
 */
export async function POST(request: NextRequest) {
  return withAuth(async () => {
    try {
      const body = await request.json().catch(() => ({}));
      const validation = validateRequest(voiceMessagePostSchema, body);
      if (!validation.success) {
        return voiceError("I didn't catch the message. Please try again.", 400);
      }

      const { message } = validation.data;

      const [defaultAuthor] = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.role, 'parent'))
        .orderBy(asc(users.sortOrder))
        .limit(1);

      if (!defaultAuthor) {
        return voiceError("I can't post a message because there's no parent configured.", 400);
      }

      await db.insert(familyMessages).values({
        message,
        authorId: defaultAuthor.id,
      });

      await invalidateEntity('messages');

      return voiceOk(`Posted message: '${message}'.`, {
        authorId: defaultAuthor.id,
        authorName: defaultAuthor.name,
      });
    } catch (error) {
      logError('Voice API: message/post failed', error);
      return voiceError('Sorry, I had trouble posting that message.', 500);
    }
  }, {
    tokenScope: 'voice',
    rateLimit: { feature: 'voice-api', limit: 60, windowSeconds: 60 },
  });
}
