/**
 * OAuth state-nonce helpers (CSRF / account-binding protection).
 *
 * Without a verified state nonce, an OAuth callback will honor any valid
 * `code` and bind the resulting account/token to whatever the (attacker-
 * supplied) `state` says — letting an attacker graft their own Google /
 * Microsoft account onto the family dashboard, or bind a victim's code to
 * an attacker-chosen owner. This mirrors the pattern the Kroger flow already
 * uses correctly: a random nonce is generated at /authorize, persisted in
 * Redis bound to the initiating session, and verified + consumed (single-use)
 * in the callback. The real userId is always taken from the session, never
 * from `state`.
 */

import { randomUUID } from 'crypto';
import { getRedisClient } from '@/lib/cache/getRedisClient';

/** Seconds the user has to complete the consent screen. */
export const OAUTH_STATE_TTL = 600; // 10 minutes

function stateKey(provider: string, nonce: string): string {
  return `${provider}-oauth-state:${nonce}`;
}

/**
 * Generate a random state nonce, bound to `userId` plus an arbitrary JSON
 * payload (returnSection, sourceName, reauth, …), and persist it in Redis.
 * Returns the nonce to send as the OAuth `state` param.
 *
 * If Redis is unavailable the nonce is still returned (so the flow proceeds,
 * matching the Kroger degradation), but it will not verify in the callback —
 * the whole app already depends on Redis for sessions, so this window is
 * narrow.
 */
export async function createOAuthState(
  provider: string,
  userId: string,
  payload: Record<string, unknown> = {},
): Promise<string> {
  const nonce = randomUUID();
  const redis = await getRedisClient();
  if (redis) {
    await redis.setEx(
      stateKey(provider, nonce),
      OAUTH_STATE_TTL,
      JSON.stringify({ userId, ...payload }),
    );
  }
  return nonce;
}

export type ConsumeOAuthStateResult =
  | { status: 'ok'; payload: Record<string, unknown> }
  | { status: 'invalid' }
  | { status: 'unavailable' };

/**
 * Verify and consume a state nonce.
 *
 * - `ok`          — nonce existed, bound to `expectedUserId`; payload returned,
 *                   key deleted (single-use).
 * - `invalid`     — Redis was reachable but the nonce is missing, malformed,
 *                   or bound to a different user. Callers MUST reject.
 * - `unavailable` — Redis was unreachable, so the nonce could not be checked.
 *                   Callers may proceed in a degraded mode (as Kroger does),
 *                   since sessions themselves already require Redis.
 */
export async function consumeOAuthState(
  provider: string,
  nonce: string | null,
  expectedUserId: string,
): Promise<ConsumeOAuthStateResult> {
  const redis = await getRedisClient();
  if (!redis) return { status: 'unavailable' };
  if (!nonce) return { status: 'invalid' };

  const key = stateKey(provider, nonce);
  const stored = await redis.get(key);
  if (!stored) return { status: 'invalid' };

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(stored) as Record<string, unknown>;
  } catch {
    return { status: 'invalid' };
  }

  if (payload.userId !== expectedUserId) return { status: 'invalid' };

  await redis.del(key);
  return { status: 'ok', payload };
}
