/**
 * The settings of the screen this browser is (#690).
 *
 * POST — save this screen's own changes, and get back the settings as stored.
 *        Body: { changes: { [storageKey]: string | null }, baseDisplayId?: string }
 *
 * The signed display cookie is the credential: a screen reads and writes only
 * its own settings. Editing another screen's is PATCH /api/displays/:id, for
 * parents.
 *
 * `baseDisplayId` is the screen the browser last synced with. When it is
 * missing or names another screen, this is the browser's first sync with this
 * one, and its changes were measured against nothing. If
 * the screen already has settings stored, the browser is a screen coming back
 * after a reset (or a new browser taking over its name), so the stored settings
 * win and its own are not sent up. If nothing is stored yet, the screen has
 * just been named, and what this browser has becomes the screen's settings.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { currentDisplay, setDisplayCookies } from '@/lib/auth/displayIdentity';
import { applySettingChanges } from '@/lib/displays/displaySettingsStore';
import { cleanSettingChanges } from '@/lib/displays/screenSettings';
import { logError } from '@/lib/utils/logError';

/** Mirrors the session cookies: secure only when the request arrived over TLS. */
function requestIsSecure(request: NextRequest): boolean {
  return (
    request.nextUrl.protocol === 'https:' ||
    request.headers.get('x-forwarded-proto') === 'https'
  );
}

function shape(row: { id: string; dashboardId: string | null }, settings: unknown, updatedAt: Date | null) {
  return {
    displayId: row.id,
    dashboardId: row.dashboardId,
    settings: settings ?? {},
    settingsUpdatedAt: updatedAt?.toISOString() ?? null,
  };
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const changes = cleanSettingChanges(body?.changes);
  if (!changes) {
    return NextResponse.json({ error: 'Not a valid set of screen settings' }, { status: 400 });
  }

  try {
    const row = await currentDisplay();
    if (!row) {
      setDisplayCookies(await cookies(), null, requestIsSecure(request));
      return NextResponse.json({ error: 'This browser is not a named screen' }, { status: 404 });
    }

    const firstSync = body?.baseDisplayId !== row.id;
    const adopting = firstSync && Object.keys(row.settings ?? {}).length > 0;
    if (adopting || Object.keys(changes).length === 0) {
      return NextResponse.json(shape(row, row.settings, row.settingsUpdatedAt));
    }

    const stored = await applySettingChanges(row.id, changes);
    if (!stored) return NextResponse.json({ error: 'This browser is not a named screen' }, { status: 404 });
    return NextResponse.json(shape(row, stored.settings, stored.settingsUpdatedAt));
  } catch (error) {
    logError('Failed to save display settings:', error);
    return NextResponse.json({ error: 'Failed to save display settings' }, { status: 500 });
  }
}
