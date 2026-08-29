/**
 * Resolve a task source into a provider plus usable, non-expired tokens.
 *
 * Written for the delete route, which needs to reach the provider outside the
 * periodic sync. The sync route still carries its own copy of this logic; it
 * has no test coverage at all, so it was left alone rather than refactored
 * blind. Worth folding together once that gains tests.
 */
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { taskSources } from '@/lib/db/schema';
import { decrypt, encrypt } from '@/lib/utils/crypto';
import { getTaskProvider } from '@/lib/integrations/tasks';
import type { TaskProvider, TaskProviderTokens } from '@/lib/integrations/tasks/types';

export type TaskProviderAuth =
  | { ok: true; provider: TaskProvider; tokens: TaskProviderTokens; externalListId: string }
  | { ok: false; reason: 'no_source' | 'unknown_provider' | 'no_token' | 'refresh_failed' };

export async function resolveTaskProviderAuth(sourceId: string): Promise<TaskProviderAuth> {
  const [source] = await db.select().from(taskSources).where(eq(taskSources.id, sourceId));
  if (!source) return { ok: false, reason: 'no_source' };

  const provider = getTaskProvider(source.provider);
  if (!provider) return { ok: false, reason: 'unknown_provider' };
  if (!source.accessToken) return { ok: false, reason: 'no_token' };

  let tokens: TaskProviderTokens = {
    accessToken: decrypt(source.accessToken),
    refreshToken: source.refreshToken ? decrypt(source.refreshToken) : undefined,
    expiresAt: source.tokenExpiresAt || undefined,
  };

  if (tokens.expiresAt && new Date(tokens.expiresAt) < new Date()) {
    if (!provider.refreshTokens || !tokens.refreshToken) return { ok: false, reason: 'refresh_failed' };

    const refreshed = await provider.refreshTokens(tokens);
    if (!refreshed) return { ok: false, reason: 'refresh_failed' };

    tokens = refreshed;
    // Persist the rotated tokens, so the next sync does not refresh again.
    await db
      .update(taskSources)
      .set({
        accessToken: encrypt(refreshed.accessToken),
        refreshToken: refreshed.refreshToken ? encrypt(refreshed.refreshToken) : source.refreshToken,
        tokenExpiresAt: refreshed.expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(taskSources.id, sourceId));
  }

  return { ok: true, provider, tokens, externalListId: source.externalListId };
}
