/**
 * One named screen (#690), managed from any device. Parent only.
 *
 * PATCH  — change it. Body, any of:
 *            { name: string (1 to 60 characters),
 *              dashboardId: string | null (null: the household default, #1282),
 *              switches: ScreenSwitch[] (at most 12; see screenSwitches.ts),
 *              settings: { [storageKey]: string | null } (see screenSettings.ts) }
 * DELETE — forget it. The screen goes back to being an unnamed browser; if it
 *          is this browser, its cookie is cleared too.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { eq, inArray } from 'drizzle-orm';
import { requireAuth, requireRole } from '@/lib/auth';
import {
  cleanDisplayName,
  currentDisplayId,
  DISPLAY_NAME_MAX_LENGTH,
  isDisplayId,
  setDisplayCookies,
} from '@/lib/auth/displayIdentity';
import { db } from '@/lib/db/client';
import { displays, layouts } from '@/lib/db/schema';
import { parseSwitches, switchesSchema, type ScreenSwitch } from '@/lib/screenSwitches';
import { applySettingChanges } from '@/lib/displays/displaySettingsStore';
import { cleanSettingChanges, type ScreenSettingChanges } from '@/lib/displays/screenSettings';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';

type RouteParams = {
  params: Promise<{ id: string }>;
};

/** Mirrors the session cookies: secure only when the request arrived over TLS. */
function requestIsSecure(request: NextRequest): boolean {
  return (
    request.nextUrl.protocol === 'https:' ||
    request.headers.get('x-forwarded-proto') === 'https'
  );
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const denied = requireRole(auth, 'canManageUsers');
  if (denied) return denied;

  const { id } = await params;
  if (!isDisplayId(id)) return NextResponse.json({ error: 'Display not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const update: { name?: string; dashboardId?: string | null; switches?: ScreenSwitch[] } = {};

  if (body?.name !== undefined) {
    const name = cleanDisplayName(body.name);
    if (!name) {
      return NextResponse.json(
        { error: `Give the screen a name of up to ${DISPLAY_NAME_MAX_LENGTH} characters.` },
        { status: 400 }
      );
    }
    update.name = name;
  }

  if (body?.dashboardId !== undefined) {
    if (body.dashboardId !== null && (typeof body.dashboardId !== 'string' || !isDisplayId(body.dashboardId))) {
      return NextResponse.json({ error: 'Not a dashboard' }, { status: 400 });
    }
    update.dashboardId = body.dashboardId;
  }

  if (body?.switches !== undefined) {
    const parsed = switchesSchema.safeParse(body.switches);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Not a valid set of switches (at most 12)' }, { status: 400 });
    }
    update.switches = parsed.data;
  }

  let changes: ScreenSettingChanges | null = null;
  if (body?.settings !== undefined) {
    changes = cleanSettingChanges(body.settings);
    if (!changes) return NextResponse.json({ error: 'Not a valid set of screen settings' }, { status: 400 });
  }

  const planChanged = update.dashboardId !== undefined || update.switches !== undefined;
  if (update.name === undefined && !planChanged && !changes) {
    return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });
  }

  try {
    // Every dashboard it names must exist.
    const named = [...new Set([
      ...(update.dashboardId ? [update.dashboardId] : []),
      ...(update.switches ?? []).map((s) => s.dashboardId),
    ])];
    if (named.length > 0) {
      const found = await db.select({ id: layouts.id }).from(layouts).where(inArray(layouts.id, named));
      if (found.length !== named.length) return NextResponse.json({ error: 'That dashboard does not exist' }, { status: 400 });
    }

    const [row] = await db
      .update(displays)
      .set({
        ...update,
        // Another dashboard or switch is picked up the same way as a settings
        // edit: the screen sees the timestamp move on its next heartbeat.
        ...(planChanged ? { settingsUpdatedAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(displays.id, id))
      .returning();
    if (!row) return NextResponse.json({ error: 'Display not found' }, { status: 404 });

    let settings = row.settings;
    if (changes && Object.keys(changes).length > 0) {
      const stored = await applySettingChanges(id, changes);
      if (stored) settings = stored.settings;
    }

    const what = [
      update.name !== undefined && `renamed it to "${update.name}"`,
      update.dashboardId !== undefined && 'changed its dashboard',
      update.switches !== undefined && 'changed its switches',
      changes && 'changed its settings',
    ].filter(Boolean).join(', ');
    logActivity({
      userId: auth.userId,
      action: 'update',
      entityType: 'display',
      entityId: id,
      summary: `Display "${row.name}": ${what}`,
    });
    return NextResponse.json({
      display: { id: row.id, name: row.name, dashboardId: row.dashboardId, switches: parseSwitches(row.switches), settings },
    });
  } catch (error) {
    logError('Failed to update display:', error);
    return NextResponse.json({ error: 'Failed to update the display' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const denied = requireRole(auth, 'canManageUsers');
  if (denied) return denied;

  const { id } = await params;
  if (!isDisplayId(id)) return NextResponse.json({ error: 'Display not found' }, { status: 404 });

  try {
    const [row] = await db.delete(displays).where(eq(displays.id, id)).returning();
    if (!row) return NextResponse.json({ error: 'Display not found' }, { status: 404 });
    if ((await currentDisplayId()) === id) {
      setDisplayCookies(await cookies(), null, requestIsSecure(request));
    }
    logActivity({
      userId: auth.userId,
      action: 'delete',
      entityType: 'display',
      entityId: id,
      summary: `Removed the display "${row.name}"`,
    });
    return NextResponse.json({ removed: true });
  } catch (error) {
    logError('Failed to remove display:', error);
    return NextResponse.json({ error: 'Failed to remove the display' }, { status: 500 });
  }
}
