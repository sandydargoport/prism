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
    // Distinct, sorted, non-null lowercase emails — used to render
    // "Connected as <email>" (and "+N more" for split-account setups, #100).
    const distinctEmails = (rows: Array<{ accountEmail: string | null }>): string[] =>
      [...new Set(rows.map((r) => r.accountEmail).filter((e): e is string => !!e))].sort();

    // Google: check calendar_sources with provider='google'
    const googleSources = await db
      .select({
        id: calendarSources.id,
        accessToken: calendarSources.accessToken,
        lastSynced: calendarSources.lastSynced,
        syncErrors: calendarSources.syncErrors,
        accountEmail: calendarSources.accountEmail,
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
      .select({ id: taskSources.id, accountEmail: taskSources.accountEmail })
      .from(taskSources)
      .where(eq(taskSources.provider, 'google_tasks'));

    // Microsoft: check task_sources and shopping_list_sources with provider='microsoft_todo'
    const msTaskSources = await db
      .select({ id: taskSources.id, accountEmail: taskSources.accountEmail })
      .from(taskSources)
      .where(eq(taskSources.provider, 'microsoft_todo'));

    const msShoppingSources = await db
      .select({ id: shoppingListSources.id, accountEmail: shoppingListSources.accountEmail })
      .from(shoppingListSources)
      .where(eq(shoppingListSources.provider, 'microsoft_todo'));

    const microsoftConnected = msTaskSources.length > 0 || msShoppingSources.length > 0;

    // OneDrive: check photo_sources with type='onedrive'
    const onedriveSources = await db
      .select({ id: photoSources.id, name: photoSources.name, lastSynced: photoSources.lastSynced, accountEmail: photoSources.accountEmail })
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
      columns: { id: true, accountEmail: true },
    });

    // Aggregate the connected account email(s) per provider. `accountEmail` is
    // the first one (the common single-account case); `accountEmails` carries
    // all distinct addresses so a split-account card can show the rest (#100).
    const googleEmails = distinctEmails([...googleSources, ...googleTaskSources]);
    const microsoftEmails = distinctEmails([...msTaskSources, ...msShoppingSources]);
    const onedriveEmails = distinctEmails(onedriveSources);

    return NextResponse.json({
      google: {
        connected: googleConnected || googleTaskSources.length > 0,
        expired: googleExpired,
        calendarCount: googleSources.length,
        taskSourceCount: googleTaskSources.length,
        lastSynced: lastSyncedDates[0]?.toISOString() || null,
        accountEmail: googleEmails[0] ?? null,
        accountEmails: googleEmails,
      },
      microsoft: {
        connected: microsoftConnected,
        taskSourceCount: msTaskSources.length,
        shoppingSourceCount: msShoppingSources.length,
        accountEmail: microsoftEmails[0] ?? null,
        accountEmails: microsoftEmails,
      },
      onedrive: {
        connected: onedriveSources.length > 0,
        sourceCount: onedriveSources.length,
        accountEmail: onedriveEmails[0] ?? null,
        accountEmails: onedriveEmails,
      },
      gmail: {
        connected: !!gmailCred,
        accountEmail: gmailCred?.accountEmail ?? null,
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
