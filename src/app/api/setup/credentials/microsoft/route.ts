/**
 * POST /api/setup/credentials/microsoft
 * Saves Microsoft OAuth credentials to the DB (encrypted).
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
      tasksRedirectUri?: string;
    };

    const { clientId, clientSecret, redirectUri, tasksRedirectUri } = body;
    if (!clientId?.trim() || !clientSecret?.trim() || !redirectUri?.trim()) {
      return NextResponse.json({ error: 'clientId, clientSecret, and redirectUri are required' }, { status: 400 });
    }

    const value = {
      clientId: encrypt(clientId.trim()),
      clientSecret: encrypt(clientSecret.trim()),
      redirectUri: redirectUri.trim(),
      tasksRedirectUri: (tasksRedirectUri ?? redirectUri).trim(),
    };

    const existing = await db.select().from(settings).where(eq(settings.key, 'credentials.microsoft'));
    if (existing.length > 0) {
      await db.update(settings).set({ value }).where(eq(settings.key, 'credentials.microsoft'));
    } else {
      await db.insert(settings).values({ key: 'credentials.microsoft', value });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[setup/credentials/microsoft]', error);
    return NextResponse.json({ error: 'Failed to save credentials' }, { status: 500 });
  }
}
