import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const WIFI_SETTINGS_KEY = 'wifiConfig';

/**
 * GET /api/settings/wifi - Get WiFi configuration (public for babysitter page)
 */
export async function GET() {
  try {
    const result = await db
      .select()
      .from(settings)
      .where(eq(settings.key, WIFI_SETTINGS_KEY))
      .limit(1);

    const config = result[0]?.value || null;

    return NextResponse.json({ config });
  } catch (error) {
    console.error('Error fetching WiFi config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch WiFi config' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/wifi - Save WiFi configuration
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const forbidden = requireRole(auth, 'canModifySettings');
    if (forbidden) return forbidden;

    const body = await request.json();
    const { ssid, password, securityType, hidden } = body;

    if (!ssid) {
      return NextResponse.json(
        { error: 'SSID is required' },
        { status: 400 }
      );
    }

    const config = {
      ssid: ssid || '',
      password: password || '',
      securityType: securityType || 'WPA',
      hidden: hidden || false,
    };

    // Upsert the setting
    await db
      .insert(settings)
      .values({
        key: WIFI_SETTINGS_KEY,
        value: config,
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: config },
      });

    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error('Error saving WiFi config:', error);
    return NextResponse.json(
      { error: 'Failed to save WiFi config' },
      { status: 500 }
    );
  }
}
