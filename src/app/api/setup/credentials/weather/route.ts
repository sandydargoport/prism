/**
 * POST /api/setup/credentials/weather
 * Saves OpenWeatherMap API key to the DB (encrypted).
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
    const body = await request.json() as { apiKey?: string };
    const { apiKey } = body;
    if (!apiKey?.trim()) {
      return NextResponse.json({ error: 'apiKey is required' }, { status: 400 });
    }

    const value = { apiKey: encrypt(apiKey.trim()) };

    const existing = await db.select().from(settings).where(eq(settings.key, 'credentials.weather'));
    if (existing.length > 0) {
      await db.update(settings).set({ value }).where(eq(settings.key, 'credentials.weather'));
    } else {
      await db.insert(settings).values({ key: 'credentials.weather', value });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[setup/credentials/weather]', error);
    return NextResponse.json({ error: 'Failed to save API key' }, { status: 500 });
  }
}
