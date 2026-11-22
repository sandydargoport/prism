import { createHash, randomBytes } from 'crypto';
import { db } from '@/lib/db/client';
import { apiTokens, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { AuthResult } from './requireAuth';

export interface ApiTokenAuthResult extends AuthResult {
  scopes: string[];
}

/**
 * Generate a cryptographically random 64-char hex token.
 */
export function generateApiToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * SHA-256 hash a raw token for storage/lookup.
 */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Validate a raw bearer token against the DB.
 * Returns an AuthResult (parent role) on success, null on failure.
 * A token acts as a parent only while the member who made it is still one
 * (#1246), whatever changed their role.
 * Updates lastUsedAt on successful validation.
 */
export async function validateApiToken(rawToken: string): Promise<ApiTokenAuthResult | null> {
  const hash = hashToken(rawToken);

  const [token] = await db
    .select({ id: apiTokens.id, createdBy: apiTokens.createdBy, scopes: apiTokens.scopes, creatorRole: users.role })
    .from(apiTokens)
    .innerJoin(users, eq(users.id, apiTokens.createdBy))
    .where(eq(apiTokens.tokenHash, hash))
    .limit(1);

  if (!token || token.creatorRole !== 'parent') return null;

  // Fire-and-forget lastUsedAt update (don't block the request)
  db.update(apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiTokens.id, token.id))
    .then(() => {})
    .catch(() => {});

  return {
    userId: token.createdBy,
    role: 'parent',
    scopes: token.scopes ?? ['*'],
  };
}

/**
 * Create a new API token. Returns the raw token (only visible once)
 * and the DB record (with hashed token).
 */
export async function createApiToken(name: string, createdBy: string, scopes: string[] = ['*']) {
  const rawToken = generateApiToken();
  const tokenHash = hashToken(rawToken);

  const [record] = await db
    .insert(apiTokens)
    .values({ name, tokenHash, createdBy, scopes })
    .returning();

  return {
    rawToken,
    token: record!,
  };
}

/**
 * Delete (revoke) an API token by ID.
 */
export async function revokeApiToken(tokenId: string): Promise<boolean> {
  const result = await db
    .delete(apiTokens)
    .where(eq(apiTokens.id, tokenId))
    .returning({ id: apiTokens.id });

  return result.length > 0;
}

/**
 * Delete every API token a member made (#1246), as a new role ends their
 * sessions. Returns how many went.
 */
export async function revokeApiTokensOf(userId: string): Promise<number> {
  const result = await db
    .delete(apiTokens)
    .where(eq(apiTokens.createdBy, userId))
    .returning({ id: apiTokens.id });

  return result.length;
}

/**
 * List all API tokens (without sensitive hash data).
 */
export async function listApiTokens() {
  return db
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      scopes: apiTokens.scopes,
      createdBy: apiTokens.createdBy,
      lastUsedAt: apiTokens.lastUsedAt,
      createdAt: apiTokens.createdAt,
    })
    .from(apiTokens)
    .orderBy(apiTokens.createdAt);
}
