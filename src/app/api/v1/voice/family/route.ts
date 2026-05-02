import { withAuth } from '@/lib/api/withAuth';
import { voiceOk, voiceError } from '@/lib/api/voiceResponse';
import { phraseFamilyMembers } from '@/lib/api/voicePhrases';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { ne, asc } from 'drizzle-orm';
import { logError } from '@/lib/utils/logError';

/**
 * GET /api/v1/voice/family
 *
 * Lists family members (excluding guest accounts). Used by Alexa skills
 * to populate the FAMILY_MEMBER custom slot type.
 */
export async function GET() {
  return withAuth(async () => {
    try {
      const members = await db
        .select({
          id: users.id,
          name: users.name,
          role: users.role,
          color: users.color,
        })
        .from(users)
        .where(ne(users.role, 'guest'))
        .orderBy(asc(users.sortOrder));

      const spoken = phraseFamilyMembers(members.map((m) => m.name));

      return voiceOk(spoken, {
        count: members.length,
        members,
      });
    } catch (error) {
      logError('Voice API: family failed', error);
      return voiceError('Sorry, I had trouble reading your family list.', 500);
    }
  }, {
    tokenScope: 'voice',
    rateLimit: { feature: 'voice-api', limit: 60, windowSeconds: 60 },
  });
}
