import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { calendarSources, settings } from '@/lib/db/schema';
import { logError } from '@/lib/utils/logError';
import {
  exchangeCodeForTokens,
  fetchCalendarList,
} from '@/lib/integrations/google-calendar';
import { encrypt } from '@/lib/utils/crypto';
import { logActivity } from '@/lib/services/auditLog';
import { resolveRedirectUri } from '@/lib/integrations/resolveRedirectUri';
import { fetchGoogleAccountEmail } from '@/lib/integrations/oauth-userinfo';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');

    // Parse state early to get returnSection for error redirects.
    // Default to 'integrations' (the new consolidated section). Legacy
    // callers (ConnectedAccountsSection) pass explicit returnSection=connections
    // and still land on the old section while it's mounted.
    let earlyReturnSection = 'integrations';
    if (state) {
      try {
        const parsed = JSON.parse(state);
        earlyReturnSection = parsed.returnSection || 'integrations';
      } catch { /* ignore */ }
    }

    // Anchor to use when redirecting back into the consolidated Integrations
    // page — drops the user on the Google card with the Calendars sub-section
    // auto-expanded (see useIntegrationsHashRouter).
    const integrationsAnchor = '#google-calendars';
    const anchorFor = (section: string) =>
      section === 'integrations' ? integrationsAnchor : '';

    // Check for errors from Google
    if (error) {
      logError('Google OAuth error:', error);
      return NextResponse.redirect(`${BASE_URL}/settings?section=${earlyReturnSection}&error=google_auth_denied${anchorFor(earlyReturnSection)}`);
    }

    // Ensure we have an authorization code
    if (!code) {
      return NextResponse.redirect(`${BASE_URL}/settings?section=${earlyReturnSection}&error=missing_code${anchorFor(earlyReturnSection)}`);
    }

    // Parse state to get user ID, reauth source ID, and return section
    let userId: string | null = null;
    let reauthSourceId: string | null = null;
    let returnSection = 'integrations';
    if (state) {
      try {
        const parsed = JSON.parse(state);
        userId = parsed.userId || null;
        reauthSourceId = parsed.reauth || null;
        returnSection = parsed.returnSection || 'integrations';
      } catch {
        // State parsing failed, continue without user ID
      }
    }

    // Re-derive the same request-host redirect URI used at /authorize so the
    // token exchange's redirect_uri matches byte-for-byte (#124).
    const tokens = await exchangeCodeForTokens(code, resolveRedirectUri(request, '/api/auth/google/callback'));
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Encrypt tokens before storing
    const encryptedAccessToken = encrypt(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;

    // Identify which Google account this is, for the "Connected as <email>"
    // card label (#100). Best-effort: null on failure, never blocks the flow.
    const accountEmail = await fetchGoogleAccountEmail(tokens.access_token);

    // If re-authenticating, update only calendar sources that belong to this Google account.
    // Build a set of calendar IDs visible to this account so we don't overwrite tokens
    // for calendars that belong to a different Google account.
    if (reauthSourceId) {
      const reAuthCalendars = await fetchCalendarList(tokens.access_token);
      const calendarIdSet = new Set(reAuthCalendars.map((c) => c.id));

      const existingSources = await db.select().from(calendarSources)
        .where(eq(calendarSources.provider, 'google'));

      for (const source of existingSources) {
        // Only update sources whose calendar ID is visible to this Google account
        if (!calendarIdSet.has(source.sourceCalendarId)) continue;

        const prev = (source.syncErrors as Record<string, unknown>) || {};
        await db.update(calendarSources).set({
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken || undefined,
          tokenExpiresAt,
          // Only overwrite the email when we successfully fetched one, so a
          // transient userinfo failure doesn't blank an existing label.
          accountEmail: accountEmail ?? undefined,
          syncErrors: prev.userOverride ? { userOverride: true } : null,
          updatedAt: new Date(),
        }).where(eq(calendarSources.id, source.id));
      }

      // Update showInEventModal based on current accessRole
      for (const calendar of reAuthCalendars) {
        const isWritable = calendar.accessRole === 'writer' || calendar.accessRole === 'owner';
        const existing = await db.query.calendarSources.findFirst({
          where: (cs, { and, eq }) =>
            and(
              eq(cs.provider, 'google'),
              eq(cs.sourceCalendarId, calendar.id)
            ),
        });
        if (existing) {
          await db
            .update(calendarSources)
            .set({ showInEventModal: isWritable, updatedAt: new Date() })
            .where(eq(calendarSources.id, existing.id));
        }
      }

      logActivity({
        userId: auth.userId,
        action: 'update',
        entityType: 'integration',
        summary: 'Re-authenticated Google Calendar integration',
      });

      return NextResponse.redirect(`${BASE_URL}/settings?section=${returnSection}&success=google_reauth${anchorFor(returnSection)}`);
    }

    // Fetch calendars using the plaintext token (before we discard it)
    const calendars = await fetchCalendarList(tokens.access_token);

    // Fetch dismissed Google calendar IDs so we don't recreate user-deleted calendars
    const [dismissedSetting] = await db.select().from(settings)
      .where(eq(settings.key, 'dismissedGoogleCalendarIds'));
    const dismissedIds: string[] = (dismissedSetting?.value as string[]) || [];

    for (const calendar of calendars) {
      // Skip calendars the user has previously deleted from Prism
      if (dismissedIds.includes(calendar.id)) continue;
      const existing = await db.query.calendarSources.findFirst({
        where: (cs, { and, eq }) =>
          and(
            eq(cs.provider, 'google'),
            eq(cs.sourceCalendarId, calendar.id)
          ),
      });

      if (existing) {
        const prev = (existing.syncErrors as Record<string, unknown>) || {};
        await db
          .update(calendarSources)
          .set({
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken || existing.refreshToken,
            tokenExpiresAt,
            accountEmail: accountEmail ?? undefined,
            syncErrors: prev.userOverride ? { userOverride: true } : null,
            updatedAt: new Date(),
          })
          .where(eq(calendarSources.id, existing.id));
      } else {
        const calendarName = (calendar.summary || 'Untitled Calendar').slice(0, 255);
        const isWritable = calendar.accessRole === 'writer' || calendar.accessRole === 'owner';

        await db.insert(calendarSources).values({
          userId: userId || undefined,
          provider: 'google',
          sourceCalendarId: calendar.id,
          dashboardCalendarName: calendarName,
          displayName: calendarName,
          color: calendar.backgroundColor || undefined,
          enabled: true,
          showInEventModal: isWritable,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          tokenExpiresAt,
          accountEmail,
        });
      }
    }

    logActivity({
      userId: auth.userId,
      action: 'create',
      entityType: 'integration',
      summary: `Connected Google Calendar integration (${calendars.length} calendars)`,
    });

    // Redirect back to settings with success message
    return NextResponse.redirect(`${BASE_URL}/settings?section=${returnSection}&success=google_connected${anchorFor(returnSection)}`);
  } catch (error) {
    logError('Google OAuth callback error:', error);
    // returnSection may not be in scope if parsing failed early; parse state again
    let fallbackSection = 'integrations';
    try {
      const { searchParams } = new URL(request.url);
      const s = searchParams.get('state');
      if (s) fallbackSection = JSON.parse(s).returnSection || 'integrations';
    } catch { /* ignore */ }
    const fallbackAnchor = fallbackSection === 'integrations' ? '#google-calendars' : '';
    return NextResponse.redirect(`${BASE_URL}/settings?section=${fallbackSection}&error=google_auth_failed${fallbackAnchor}`);
  }
}
