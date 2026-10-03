import { type NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { voiceOk, voiceError } from '@/lib/api/voiceResponse';
import { phraseRecentMessages } from '@/lib/api/voicePhrases';
import { db } from '@/lib/db/client';
import { familyMessages, users } from '@/lib/db/schema';
import { desc, eq, isNull, or, gt } from 'drizzle-orm';
import { getHouseholdTimezone } from '@/lib/householdTimezone';
import { guestAuthor } from '@/lib/messages/guestNotes';
import { logError } from '@/lib/utils/logError';

/**
 * GET /api/v1/voice/message/recent?count=N
 *
 * Returns the most recent (non-expired) family messages, ordered newest
 * first. `count` defaults to 3 and is clamped to 1..10.
 *
 * Auth: token with 'voice' scope. Rate-limited per caller.
 */
export async function GET(request: NextRequest) {
  return withAuth(async () => {
    try {
      const url = new URL(request.url);
      const raw = parseInt(url.searchParams.get('count') ?? '3', 10);
      const count = Number.isFinite(raw) ? Math.min(10, Math.max(1, raw)) : 3;

      const now = new Date();
      const found = await db
        .select({
          id: familyMessages.id,
          message: familyMessages.message,
          createdAt: familyMessages.createdAt,
          authorName: users.name,
          guestKind: familyMessages.guestKind,
          guestName: familyMessages.guestName,
        })
        .from(familyMessages)
        .leftJoin(users, eq(familyMessages.authorId, users.id))
        .where(or(isNull(familyMessages.expiresAt), gt(familyMessages.expiresAt, now)))
        .orderBy(desc(familyMessages.createdAt))
        .limit(count);

      // A guest note has no user row: name it, so a note the sitter wrote is
      // never read out as if a family member had (#497).
      const rows = found.map((m) => ({
        ...m,
        authorName: m.authorName ?? guestAuthor(m.guestKind, m.guestName).name,
      }));

      const spoken = phraseRecentMessages(rows, new Date(), await getHouseholdTimezone());

      return voiceOk(spoken, {
        count: rows.length,
        messages: rows.map((m) => ({
          id: m.id,
          message: m.message,
          authorName: m.authorName,
          createdAt: m.createdAt.toISOString(),
        })),
      });
    } catch (error) {
      logError('Voice API: message/recent failed', error);
      return voiceError('Sorry, I had trouble reading the messages.', 500);
    }
  }, {
    tokenScope: 'voice',
    rateLimit: { feature: 'voice-api', limit: 60, windowSeconds: 60 },
  });
}
