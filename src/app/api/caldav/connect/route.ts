import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import type { AuthResult } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { calendarSources } from '@/lib/db/schema';
import { encrypt } from '@/lib/utils/crypto';
import { invalidateCache } from '@/lib/cache/redis';
import { logActivity } from '@/lib/services/auditLog';
import { testCalDAVConnection } from '@/lib/integrations/caldav';

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
    const { serverUrl, username, password, calendars } = await request.json();

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
    const caldavConfig = {
      serverUrl,
      username,
      authMethod: 'basic',
    };

    const created: string[] = [];

    for (const cal of calendars) {
      const { href, displayName, color } = cal as { href: string; displayName: string; color?: string };

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

    return NextResponse.json({
      success: true,
      message: `Connected ${created.length} calendar(s)`,
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
