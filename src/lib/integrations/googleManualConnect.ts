/**
 * Persist a manually-pasted Google token for the capabilities that do not
 * already have a shared store.
 *
 * Both functions deliberately write exactly what the corresponding browser
 * OAuth callback writes, so nothing downstream can tell which route produced
 * the connection. The redirect flow's only unique job was obtaining the tokens;
 * once they exist, the rest of each flow is identical.
 */

import { db } from '@/lib/db/client';
import { apiCredentials } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { encrypt } from '@/lib/utils/crypto';
import { getRedisClient } from '@/lib/cache/getRedisClient';

/** Matches TEMP_TOKEN_TTL in the google-tasks callback (5 minutes). */
const TEMP_TOKEN_TTL = 300;

interface TokenBundle {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  accountEmail?: string | null;
}

/**
 * Park Tasks tokens where the list picker expects to find them.
 *
 * The browser callback stores them in Redis under this key and redirects to a
 * list picker; `/api/task-sources/google-lists` reads the key to list the
 * user's task lists and `/api/task-sources/finalize` reads it again to create
 * the source. Writing the same key means both of those work untouched.
 */
export async function stashGoogleTasksTokens(
  opts: TokenBundle & { userId: string },
): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) throw new Error('redis_unavailable');

  await redis.setEx(
    `google-tasks-temp:${opts.userId}:task:new`,
    TEMP_TOKEN_TTL,
    JSON.stringify({
      accessToken: encrypt(opts.accessToken),
      refreshToken: encrypt(opts.refreshToken),
      tokenExpiresAt: new Date(Date.now() + opts.expiresIn * 1000).toISOString(),
      rawAccessToken: opts.accessToken,
      accountEmail: opts.accountEmail ?? null,
    }),
  );
}

/**
 * Upsert the Gmail credentials bus tracking reads.
 *
 * Same `service: 'gmail-bus'` row the google-bus callback writes.
 */
export async function storeGmailBusCredentials(opts: TokenBundle): Promise<void> {
  const credentials = {
    accessToken: encrypt(opts.accessToken),
    refreshToken: encrypt(opts.refreshToken),
  };
  const expiresAt = new Date(Date.now() + opts.expiresIn * 1000);

  const existing = await db.query.apiCredentials.findFirst({
    where: (creds, { eq: e }) => e(creds.service, 'gmail-bus'),
  });

  if (existing) {
    await db
      .update(apiCredentials)
      .set({
        encryptedCredentials: JSON.stringify(credentials),
        expiresAt,
        accountEmail: opts.accountEmail ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(apiCredentials.id, existing.id));
  } else {
    await db.insert(apiCredentials).values({
      service: 'gmail-bus',
      encryptedCredentials: JSON.stringify(credentials),
      expiresAt,
      accountEmail: opts.accountEmail ?? null,
    });
  }
}
