/**
 * POST /api/setup/credentials/kroger
 * Saves Kroger OAuth credentials to the DB (encrypted).
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { encrypt } from '@/lib/utils/crypto';
import { requireAuth, requireRole } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;

  try {
    const body = await request.json() as {
      clientId?: string;
      clientSecret?: string;
      redirectUri?: string;
    };

    const { clientId, clientSecret, redirectUri } = body;
    if (!clientId?.trim() || !clientSecret?.trim() || !redirectUri?.trim()) {
      return NextResponse.json(
        { error: 'clientId, clientSecret, and redirectUri are required' },
        { status: 400 },
      );
    }

    const value = {
      clientId: encrypt(clientId.trim()),
      clientSecret: encrypt(clientSecret.trim()),
      redirectUri: redirectUri.trim(),
    };

    const existing = await db.select().from(settings).where(eq(settings.key, 'credentials.kroger'));
    if (existing.length > 0) {
      await db.update(settings).set({ value }).where(eq(settings.key, 'credentials.kroger'));
    } else {
      await db.insert(settings).values({ key: 'credentials.kroger', value });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[setup/credentials/kroger]', error);
    return NextResponse.json({ error: 'Failed to save credentials' }, { status: 500 });
  }
}
