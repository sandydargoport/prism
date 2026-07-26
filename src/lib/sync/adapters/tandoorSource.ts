/**
 * Shared resolver for a Tandoor connection (stored in recipe_sources). Both the
 * recipe adapter and the meal-plan adapter run against the same connection, so
 * they load + decrypt it through this one helper.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { recipeSources } from '@/lib/db/schema';
import { decrypt } from '@/lib/utils/crypto';

export interface ResolvedTandoorSource {
  serverUrl: string;
  token: string;
}

export async function loadTandoorSource(sourceId: string): Promise<ResolvedTandoorSource> {
  const [src] = await db.select().from(recipeSources).where(eq(recipeSources.id, sourceId));
  if (!src) throw new Error('Recipe source not found');
  if (src.provider !== 'tandoor') throw new Error('Not a Tandoor recipe source');
  if (!src.serverUrl || !src.accessToken) {
    throw new Error('Recipe source is missing its server URL or API token');
  }
  return { serverUrl: src.serverUrl, token: decrypt(src.accessToken) };
}
