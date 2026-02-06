import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { taskSources } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt, encrypt } from '@/lib/utils/crypto';
import { getTaskProvider } from '@/lib/integrations/tasks';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/task-sources/[id]/lists
 *
 * Fetches available lists from the provider using the source's stored tokens.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageIntegrations');
  if (forbidden) return forbidden;

  const { id: sourceId } = await params;

  try {
    const [source] = await db
      .select()
      .from(taskSources)
      .where(eq(taskSources.id, sourceId));

    if (!source) {
      return NextResponse.json(
        { error: 'Task source not found' },
        { status: 404 }
      );
    }

    if (!source.accessToken) {
      return NextResponse.json(
        { error: 'No access token. Please reconnect the provider.' },
        { status: 401 }
      );
    }

    const provider = getTaskProvider(source.provider);
    if (!provider) {
      return NextResponse.json(
        { error: `Unknown provider: ${source.provider}` },
        { status: 400 }
      );
    }

    // Decrypt tokens
    let accessToken = decrypt(source.accessToken);
    const refreshToken = source.refreshToken ? decrypt(source.refreshToken) : undefined;

    // Check if token is expired and refresh if needed
    if (source.tokenExpiresAt && new Date(source.tokenExpiresAt) < new Date()) {
      if (provider.refreshTokens && refreshToken) {
        const newTokens = await provider.refreshTokens({
          accessToken,
          refreshToken,
          expiresAt: source.tokenExpiresAt,
        });

        if (newTokens) {
          accessToken = newTokens.accessToken;
          // Update tokens in database
          await db
            .update(taskSources)
            .set({
              accessToken: encrypt(newTokens.accessToken),
              refreshToken: newTokens.refreshToken ? encrypt(newTokens.refreshToken) : source.refreshToken,
              tokenExpiresAt: newTokens.expiresAt,
              updatedAt: new Date(),
            })
            .where(eq(taskSources.id, sourceId));
        } else {
          return NextResponse.json(
            { error: 'Token refresh failed. Please reconnect the provider.' },
            { status: 401 }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'Token expired. Please reconnect the provider.' },
          { status: 401 }
        );
      }
    }

    // Fetch lists from provider
    const lists = await provider.fetchLists({ accessToken });

    return NextResponse.json({ lists });
  } catch (error) {
    console.error('Error fetching provider lists:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lists from provider' },
      { status: 500 }
    );
  }
}
