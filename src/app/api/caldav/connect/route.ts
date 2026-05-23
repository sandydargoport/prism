import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import type { AuthResult } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { calendarSources } from '@/lib/db/schema';
import { encrypt } from '@/lib/utils/crypto';
import { invalidateCache } from '@/lib/cache/redis';
import { logActivity } from '@/lib/services/auditLog';
import { testCalDAVConnection } from '@/lib/integrations/caldav';
import { syncCalDAVCalendarSource, syncCalDAVTasks } from '@/lib/services/calendar-sync';
import { syncCardDAVBirthdays } from '@/lib/services/carddav-birthday-sync';

/**
 * POST /api/caldav/connect
 * Connect selected CalDAV calendars as calendar sources.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;

  try {
    const { serverUrl, username, password, calendars, syncContactBirthdays } = await request.json();

    if (!serverUrl || !username || !password || !Array.isArray(calendars) || calendars.length === 0) {
      return NextResponse.json(
        { error: 'Server URL, credentials, and at least one calendar are required' },
        { status: 400 }
      );
    }

    // Verify connection before storing
    const test = await testCalDAVConnection(serverUrl, username, password);
    if (!test.success) {
      return NextResponse.json(
        { error: test.error || 'Connection failed' },
        { status: 400 }
      );
    }

    const encryptedPassword = encrypt(password);

    const created: string[] = [];

    for (let i = 0; i < calendars.length; i++) {
      const cal = calendars[i];
      const { href, displayName, color, supportsEvents, supportsTasks } = cal as {
        href: string;
        displayName: string;
        color?: string;
        supportsEvents?: boolean;
        supportsTasks?: boolean;
      };

      // Store supports flags inline with the CalDAV connection config so
      // sync + UI can route this source correctly. Default both to true when
      // discovery didn't tell us — old behavior of "sync both" preserved.
      // Anchor contactBirthdaysEnabled on the first inserted row only — the
      // CardDAV sync only needs one anchor row to read credentials from,
      // and multiplying it across N calendars would mean N independent
      // sync attempts on the same address book.
      const caldavConfig: Record<string, unknown> = {
        serverUrl,
        username,
        authMethod: 'basic',
        supportsEvents: supportsEvents !== false,
        supportsTasks: supportsTasks !== false,
      };
      if (i === 0 && syncContactBirthdays) {
        caldavConfig.contactBirthdaysEnabled = true;
      }

      const [source] = await db
        .insert(calendarSources)
        .values({
          provider: 'caldav',
          sourceCalendarId: href,
          dashboardCalendarName: displayName,
          displayName: displayName,
          color: color || '#6366f1',
          accessToken: encryptedPassword,
          syncErrors: caldavConfig,
          enabled: true,
          showInEventModal: false, // Read-only
        })
        .returning();

      if (source) created.push(source.id);
    }

    await invalidateCache('calendar-sources:*');
    await invalidateCache('calendar-groups:*');
    await invalidateCache('events:*');

    logActivity({
      userId: (auth as AuthResult).userId,
      action: 'create',
      entityType: 'integration',
      entityId: 'caldav',
      summary: `Connected ${created.length} CalDAV calendar(s) from ${serverUrl}`,
    });

    // Fire-and-forget initial sync so the user sees events / tasks within
    // seconds of connecting instead of waiting up to 10 minutes for the
    // periodic cron. Errors logged server-side; the response returns 201
    // immediately regardless.
    (async () => {
      for (const sourceId of created) {
        try {
          await syncCalDAVCalendarSource(sourceId);
          await syncCalDAVTasks(sourceId);
        } catch (err) {
          console.error(`Initial CalDAV sync failed for source ${sourceId}:`,
            err instanceof Error ? err.message : err);
        }
      }
      if (syncContactBirthdays) {
        try {
          const r = await syncCardDAVBirthdays();
          if (r.errors.length) console.error('Initial CardDAV birthday sync errors:', r.errors);
        } catch (err) {
          console.error('Initial CardDAV birthday sync failed:',
            err instanceof Error ? err.message : err);
        }
        await invalidateCache('birthdays:*').catch(() => {});
      }
      // Invalidate event/task caches AFTER sync completes so the dashboard
      // picks up the new rows on its next poll.
      await invalidateCache('events:*').catch(() => {});
      await invalidateCache('tasks:*').catch(() => {});
    })();

    return NextResponse.json({
      success: true,
      message: `Connected ${created.length} calendar(s) — syncing in background`,
      sourceIds: created,
    }, { status: 201 });
  } catch (error) {
    console.error('CalDAV connect error:', error);
    return NextResponse.json(
      { error: 'Failed to connect CalDAV calendars' },
      { status: 500 }
    );
  }
}
