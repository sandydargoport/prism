import { NextResponse } from 'next/server';
import { getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { calendarSources, taskSources, shoppingListSources, photoSources, apiCredentials } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { logError } from '@/lib/utils/logError';

export async function GET() {
  const auth = await getDisplayAuth();
  if (!auth) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    // Google: check calendar_sources with provider='google'
    const googleSources = await db
      .select({
        id: calendarSources.id,
        accessToken: calendarSources.accessToken,
        lastSynced: calendarSources.lastSynced,
        syncErrors: calendarSources.syncErrors,
      })
      .from(calendarSources)
      .where(eq(calendarSources.provider, 'google'));

    const googleConnected = googleSources.some((s) => s.accessToken);
    const googleExpired = googleSources.some(
      (s) => s.syncErrors && (s.syncErrors as Record<string, unknown>).needsReauth
    );
    const lastSyncedDates = googleSources
      .map((s) => s.lastSynced)
      .filter(Boolean)
      .sort((a, b) => (b!.getTime() - a!.getTime()));

    // Google Tasks: check task_sources with provider='google_tasks'
    const googleTaskSources = await db
      .select({ id: taskSources.id })
      .from(taskSources)
      .where(eq(taskSources.provider, 'google_tasks'));

    // Microsoft: check task_sources and shopping_list_sources with provider='microsoft_todo'
    const msTaskSources = await db
      .select({ id: taskSources.id })
      .from(taskSources)
      .where(eq(taskSources.provider, 'microsoft_todo'));

    const msShoppingSources = await db
      .select({ id: shoppingListSources.id })
      .from(shoppingListSources)
      .where(eq(shoppingListSources.provider, 'microsoft_todo'));

    const microsoftConnected = msTaskSources.length > 0 || msShoppingSources.length > 0;

    // OneDrive: check photo_sources with type='onedrive'
    const onedriveSources = await db
      .select({ id: photoSources.id, name: photoSources.name, lastSynced: photoSources.lastSynced })
      .from(photoSources)
      .where(eq(photoSources.type, 'onedrive'));

    // Gmail: check api_credentials with service='gmail-bus'. We deliberately
    // don't surface expiresAt here. Gmail access tokens have a 1-hour TTL but
    // bus-tracking-sync.ts auto-refreshes them on the next sync tick via the
    // stored refresh token, so a "past expires_at" is not a user-actionable
    // problem. When the refresh truly fails (TokenRevokedError), the sync
    // path deletes the credential row outright — at which point this query
    // returns null and `connected: false` flips the UI to "Connect Gmail".
    const gmailCred = await db.query.apiCredentials.findFirst({
      where: (c, { eq: eqFn }) => eqFn(c.service, 'gmail-bus'),
      columns: { id: true },
    });

    return NextResponse.json({
      google: {
        connected: googleConnected || googleTaskSources.length > 0,
        expired: googleExpired,
        calendarCount: googleSources.length,
        taskSourceCount: googleTaskSources.length,
        lastSynced: lastSyncedDates[0]?.toISOString() || null,
      },
      microsoft: {
        connected: microsoftConnected,
        taskSourceCount: msTaskSources.length,
        shoppingSourceCount: msShoppingSources.length,
      },
      onedrive: {
        connected: onedriveSources.length > 0,
        sourceCount: onedriveSources.length,
      },
      gmail: {
        connected: !!gmailCred,
      },
    });
  } catch (error) {
    logError('Error fetching integration status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch integration status' },
      { status: 500 }
    );
  }
}
