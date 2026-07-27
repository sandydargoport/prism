import { NextRequest, NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { recipeSources } from '@/lib/db/schema';
import { requireAuth, requireRole } from '@/lib/auth';
import { rateLimitGuard } from '@/lib/cache/rateLimit';
import { encrypt } from '@/lib/utils/crypto';
import { logError } from '@/lib/utils/logError';
import { UnsafeUrlError } from '@/lib/integrations/tandoor';
import { isSupportedProvider, testProviderConnection } from '@/lib/sync/adapters/registry';

/**
 * GET /api/recipe-sources — list connected recipe servers (no secrets).
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
      createdAt: recipeSources.createdAt,
    })
    .from(recipeSources)
    .orderBy(desc(recipeSources.createdAt));
  return NextResponse.json({ sources: rows });
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

    // Verify the server + token before storing anything.
    await testProviderConnection(provider, serverUrl, token);

    const [row] = await db
      .insert(recipeSources)
      .values({
        provider,
        name: name || null,
        serverUrl,
        accessToken: encrypt(token),
        createdBy: auth.userId,
      })
      .returning({ id: recipeSources.id });

    return NextResponse.json({ id: row?.id }, { status: 201 });
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
