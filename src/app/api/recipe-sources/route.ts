import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { recipeSources } from '@/lib/db/schema';
import { requireAuth, requireRole } from '@/lib/auth';
import { rateLimitGuard } from '@/lib/cache/rateLimit';
import { decrypt, encrypt } from '@/lib/utils/crypto';
import { logError } from '@/lib/utils/logError';
import { UnsafeUrlError } from '@/lib/integrations/tandoor';
import { checkProviderWriteAccess, isSupportedProvider, testProviderConnection } from '@/lib/sync/adapters/registry';

/** What Prism knows about a source's token, kept in providerConfig (#1205). */
interface RecipeSourceConfig {
  canWrite?: boolean;
  writeCheckedAt?: string;
}

const RECHECK_NO_AFTER_MS = 24 * 60 * 60 * 1000;

function writeConfig(canWrite: boolean): RecipeSourceConfig {
  return { canWrite, writeCheckedAt: new Date().toISOString() };
}

/**
 * GET /api/recipe-sources — list connected recipe servers (no secrets), with
 * whether each token can write. A source connected before that was recorded
 * is checked once here and the answer kept.
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, 'canManageIntegrations');
  if (forbidden) return forbidden;

  const rows = await db
    .select({
      id: recipeSources.id,
      provider: recipeSources.provider,
      name: recipeSources.name,
      serverUrl: recipeSources.serverUrl,
      enabled: recipeSources.enabled,
      lastSynced: recipeSources.lastSynced,
      syncErrors: recipeSources.syncErrors,
      providerConfig: recipeSources.providerConfig,
      accessToken: recipeSources.accessToken,
      createdAt: recipeSources.createdAt,
    })
    .from(recipeSources)
    .orderBy(desc(recipeSources.createdAt));

  const sources = await Promise.all(rows.map(async ({ accessToken, providerConfig, ...row }) => {
    const cfg = (providerConfig as RecipeSourceConfig | null) ?? {};
    let canWrite = cfg.canWrite;
    // A "no" is asked again after a day: it may have been a server that was
    // down for a moment, not a token that reads only.
    const stale = canWrite === false
      && Date.now() - new Date(cfg.writeCheckedAt ?? 0).getTime() > RECHECK_NO_AFTER_MS;
    if ((canWrite === undefined || stale) && accessToken) {
      try {
        canWrite = await checkProviderWriteAccess(row.provider, row.serverUrl, decrypt(accessToken));
        await db.update(recipeSources)
          .set({ providerConfig: { ...cfg, ...writeConfig(canWrite) } })
          .where(eq(recipeSources.id, row.id));
      } catch (error) {
        logError('Error checking a recipe source token:', error);
        canWrite = undefined;
      }
    }
    return { ...row, canWrite: canWrite ?? false };
  }));
  return NextResponse.json({ sources });
}

/**
 * POST /api/recipe-sources — connect a recipe server. Verifies reachability
 * before storing; the API token is encrypted at rest.
 * Body: { provider: 'tandoor', serverUrl, token, name? }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, 'canManageIntegrations');
  if (forbidden) return forbidden;

  const limited = await rateLimitGuard(auth.userId, 'recipe-sources:create', 10, 60);
  if (limited) return limited;

  try {
    const body = await request.json();
    const provider = typeof body.provider === 'string' && isSupportedProvider(body.provider) ? body.provider : null;
    const serverUrl = typeof body.serverUrl === 'string' ? body.serverUrl.trim() : '';
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';

    if (!provider) {
      return NextResponse.json({ error: 'Supported providers are Tandoor and Mealie.' }, { status: 400 });
    }
    if (!serverUrl || !token) {
      return NextResponse.json({ error: 'Server URL and API token are required.' }, { status: 400 });
    }

    // Verify the server + token before storing anything. Whether it can write
    // is only reported: a token that reads still connects.
    await testProviderConnection(provider, serverUrl, token);
    const canWrite = await checkProviderWriteAccess(provider, serverUrl, token);

    const [row] = await db
      .insert(recipeSources)
      .values({
        provider,
        name: name || null,
        serverUrl,
        accessToken: encrypt(token),
        providerConfig: writeConfig(canWrite),
        createdBy: auth.userId,
      })
      .returning({ id: recipeSources.id });

    return NextResponse.json({ id: row?.id, canWrite }, { status: 201 });
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    logError('Error connecting recipe source:', error);
    const msg = error instanceof Error ? error.message : 'Failed to connect.';
    if (error instanceof Error && /token|reach|Tandoor|Mealie/i.test(error.message)) {
      return NextResponse.json({ error: msg }, { status: 502 });
    }
    return NextResponse.json({ error: 'Failed to connect the recipe source.' }, { status: 500 });
  }
}
