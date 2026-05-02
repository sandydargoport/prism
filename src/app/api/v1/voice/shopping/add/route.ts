import { type NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { voiceOk, voiceError } from '@/lib/api/voiceResponse';
import { db } from '@/lib/db/client';
import { shoppingItems, shoppingLists } from '@/lib/db/schema';
import { ilike, asc } from 'drizzle-orm';
import { voiceShoppingAddSchema, validateRequest } from '@/lib/validations';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logError } from '@/lib/utils/logError';

/**
 * POST /api/v1/voice/shopping/add
 *
 * Body: { item, list?, quantity?, unit? }
 * If `list` is given, fuzzy-matches a shopping list by name. Otherwise
 * adds to the first shopping list (by sortOrder).
 */
export async function POST(request: NextRequest) {
  return withAuth(async (auth) => {
    try {
      const body = await request.json().catch(() => ({}));
      const validation = validateRequest(voiceShoppingAddSchema, body);
      if (!validation.success) {
        return voiceError("I didn't catch what you wanted to add. Please try again.", 400);
      }

      const { item, list, quantity, unit } = validation.data;

      const targetList = list
        ? (await db
            .select()
            .from(shoppingLists)
            .where(ilike(shoppingLists.name, `%${list}%`))
            .orderBy(asc(shoppingLists.sortOrder))
            .limit(1))[0]
        : (await db
            .select()
            .from(shoppingLists)
            .orderBy(asc(shoppingLists.sortOrder))
            .limit(1))[0];

      if (!targetList) {
        return voiceError(
          list
            ? `I couldn't find a shopping list matching '${list}'.`
            : `You don't have any shopping lists yet.`,
          404,
        );
      }

      await db.insert(shoppingItems).values({
        listId: targetList.id,
        name: item,
        quantity: quantity ?? null,
        unit: unit ?? null,
        addedBy: auth.userId,
      });

      await invalidateEntity('shopping-lists');

      return voiceOk(`Added ${item} to ${targetList.name}.`, {
        listId: targetList.id,
        listName: targetList.name,
        item,
      });
    } catch (error) {
      logError('Voice API: shopping/add failed', error);
      return voiceError('Sorry, I had trouble adding that to your shopping list.', 500);
    }
  }, {
    tokenScope: 'voice',
    rateLimit: { feature: 'voice-api', limit: 60, windowSeconds: 60 },
  });
}
