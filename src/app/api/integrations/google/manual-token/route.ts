/**
 * POST /api/integrations/google/manual-token
 *
 * Connect Google Calendar (full read/write) by pasting {client id, client
 * secret, refresh token} generated via Google's OAuth 2.0 Playground — for
 * LAN-only installs that can't register a public HTTPS redirect URI. No browser
 * redirect, no hosted relay.
 *
 * Security posture (see the manual-token threat model):
 *  - Auth-gated (canModifySettings); userId comes from the session, never input.
 *  - Write-only: there is no GET; the response never contains token/secret material.
 *  - The pasted refresh token, client secret, and client id are encrypted at rest.
 *  - The request body is NEVER logged; error logs carry only a fixed category.
 *  - Validates the pasted token with exactly one refresh + one calendar-list call.
 */
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { encrypt } from '@/lib/utils/crypto';
import { logError } from '@/lib/utils/logError';
import { EncryptionKeyError } from '@/lib/utils/crypto';
import { detectCapabilities, describeCapabilities } from '@/lib/integrations/googleManualScopes';
import { stashGoogleTasksTokens, storeGmailBusCredentials } from '@/lib/integrations/googleManualConnect';
import { logActivity } from '@/lib/services/auditLog';
import { getGoogleCredentials } from '@/lib/integrations/credentialStore';
import { refreshAccessToken, TokenRevokedError } from '@/lib/integrations/google-calendar';
import { fetchGoogleAccountEmail } from '@/lib/integrations/oauth-userinfo';
import { storeGoogleCalendarConnection } from '@/lib/integrations/googleCalendarStore';
import { googleManualTokenSchema } from '@/lib/validations/googleManualToken';

const CREDENTIALS_KEY = 'credentials.google';

/** Persist the pasted client id/secret to the same key the setup wizard writes. */
async function upsertGoogleClientCredentials(
  clientId: string,
  clientSecret: string,
  existing: { redirectUri?: string; gmailRedirectUri?: string } | null,
): Promise<void> {
  const value = {
    clientId: encrypt(clientId),
    clientSecret: encrypt(clientSecret),
    // Redirect URI is unused by the refresh grant; preserve any existing value.
    redirectUri: existing?.redirectUri ?? '',
    gmailRedirectUri: existing?.gmailRedirectUri ?? existing?.redirectUri ?? '',
  };
  const rows = await db.select().from(settings).where(eq(settings.key, CREDENTIALS_KEY));
  if (rows.length > 0) {
    await db.update(settings).set({ value }).where(eq(settings.key, CREDENTIALS_KEY));
  } else {
    await db.insert(settings).values({ key: CREDENTIALS_KEY, value });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;

  // Parse + validate. Field names may be surfaced; submitted values never are.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_input', message: 'Request body must be JSON.' }, { status: 400 });
  }
  const parsed = googleManualTokenSchema.safeParse(body);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path.join('.') || 'input';
    return NextResponse.json(
      { error: 'invalid_input', message: `The ${field} field is missing or malformed.` },
      { status: 400 },
    );
  }
  const { clientId, clientSecret, refreshToken, overwriteCredentials } = parsed.data;

  try {
    // Guard: replacing a *different* stored client would break browser-flow
    // connections. Require explicit confirmation. A rotated secret for the same
    // client id is a normal update and proceeds.
    const existing = await getGoogleCredentials();
    if (existing?.clientId && existing.clientId !== clientId && !overwriteCredentials) {
      return NextResponse.json(
        {
          error: 'client_mismatch_confirm_required',
          message:
            'A different Google client is already configured. Replacing it will break any calendars connected through the browser flow until they are re-authenticated.',
        },
        { status: 409 },
      );
    }

    // Validate the pasted token against the pasted creds — exactly one refresh.
    let tokens;
    try {
      tokens = await refreshAccessToken(refreshToken, { clientId, clientSecret });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (err instanceof TokenRevokedError || /invalid_grant/i.test(msg)) {
        return NextResponse.json(
          {
            error: 'invalid_grant',
            message:
              'Google rejected the refresh token. It may be revoked, expired (consent screens in "Testing" mode expire refresh tokens after 7 days), or minted with a different client ID/secret than the ones you pasted.',
          },
          { status: 400 },
        );
      }
      if (/invalid_client|unauthorized_client/i.test(msg)) {
        return NextResponse.json(
          { error: 'invalid_client', message: 'Google rejected the client ID / secret pair.' },
          { status: 400 },
        );
      }
      // Network / unexpected — log a fixed category only, never the message body.
      logError('google/manual-token: token validation failed', 'network_or_unexpected');
      return NextResponse.json(
        { error: 'google_unreachable', message: 'Could not reach Google to validate the token. Please try again.' },
        { status: 502 },
      );
    }

    // Enable whatever the token actually covers, rather than requiring
    // Calendar. Scopes are fixed when the token is authorised, so this is the
    // user's choice made in the Playground: tick Tasks but not Gmail and you
    // get Tasks but not Gmail. Only a token covering nothing is an error.
    const capabilities = detectCapabilities(tokens.scope);
    if (capabilities.length === 0) {
      return NextResponse.json(
        {
          error: 'no_supported_scope',
          message:
            'This token was not granted any scope Prism can use. In the OAuth Playground, select at least one of: ' +
            'Google Calendar API v3, Tasks API v1, or Gmail API v1 (for bus tracking), then authorize again.',
        },
        { status: 400 },
      );
    }

    // Best-effort account email (Playground tokens often lack the email scope;
    // storeGoogleCalendarConnection falls back to the primary calendar id).
    const accountEmail = await fetchGoogleAccountEmail(tokens.access_token);

    // Persist the pasted client creds BEFORE storing rows: the refresh token is
    // bound to this client, so background sync must use exactly this pair.
    await upsertGoogleClientCredentials(clientId, clientSecret, existing);

    // Store calendars. Persist the *pasted* refresh token — the refresh grant
    // does not return a new one.
    let result: { calendarCount: number; accountEmail?: string | null } = { calendarCount: 0 };
    if (capabilities.includes('calendar') || capabilities.includes('calendarReadonly')) {
    try {
      result = await storeGoogleCalendarConnection({
        userId: auth.userId,
        tokens: { accessToken: tokens.access_token, refreshToken, expiresIn: tokens.expires_in },
        accountEmail,
        readOnly: capabilities.includes('calendarReadonly'),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (/accessNotConfigured|SERVICE_DISABLED|has not been used|PERMISSION_DENIED|Calendar API/i.test(msg)) {
        return NextResponse.json(
          {
            error: 'calendar_api_disabled',
            message: 'Enable the Google Calendar API for this project in the Google Cloud Console.',
          },
          { status: 400 },
        );
      }
      logError('google/manual-token: reading calendar list failed', 'unexpected');
      return NextResponse.json(
        { error: 'google_unreachable', message: 'Could not read your calendar list from Google. Please try again.' },
        { status: 502 },
      );
    }
    }

    // Tasks: hand off to the flow the browser callback already feeds. It parks
    // the tokens in Redis under a per-user key, then the existing list picker
    // and /api/task-sources/finalize take over unchanged — the only step the
    // redirect flow owned was getting the tokens there in the first place.
    if (capabilities.includes('tasks')) {
      try {
        await stashGoogleTasksTokens({
          userId: auth.userId,
          accessToken: tokens.access_token,
          refreshToken,
          expiresIn: tokens.expires_in,
          accountEmail,
        });
      } catch (err) {
        logError('google/manual-token: stashing tasks tokens failed', err instanceof Error ? err.name : 'error');
        return NextResponse.json(
          { error: 'tasks_stash_failed', message: 'Connected, but could not start the Tasks list picker. Please try again.' },
          { status: 502 },
        );
      }
    }

    // Gmail: used only by bus tracking. Same credential row the browser flow
    // writes, so nothing downstream can tell which route produced it.
    if (capabilities.includes('gmail')) {
      try {
        await storeGmailBusCredentials({
          accessToken: tokens.access_token,
          refreshToken,
          expiresIn: tokens.expires_in,
          accountEmail,
        });
      } catch (err) {
        logError('google/manual-token: storing gmail credentials failed', err instanceof Error ? err.name : 'error');
        return NextResponse.json(
          { error: 'gmail_store_failed', message: 'Could not save the Gmail connection. Please try again.' },
          { status: 502 },
        );
      }
    }

    logActivity({
      userId: auth.userId,
      action: 'create',
      entityType: 'integration',
      summary: `Connected Google via manual refresh token: ${describeCapabilities(capabilities)}${
        capabilities.includes('calendar') || capabilities.includes('calendarReadonly')
          ? ` (${result.calendarCount} calendars)`
          : ''
      }`,
    });

    return NextResponse.json({
      ok: true,
      capabilities,
      // Named so the UI can tell the user what this token did and did not
      // cover. Someone who meant to include Tasks but forgot to tick it in the
      // Playground otherwise sees a success message and no Tasks.
      enabled: describeCapabilities(capabilities),
      needsTaskListSelection: capabilities.includes('tasks'),
      calendarCount: result.calendarCount,
      accountEmail: result.accountEmail ?? accountEmail,
    });
  } catch (err) {
    // A misconfigured encryption key is a configuration problem, not a token
    // problem, and saying so saves the user from troubleshooting Google. The
    // message names no secret — only the shape of the key that was expected.
    if (err instanceof EncryptionKeyError) {
      logError('google/manual-token failed: encryption key invalid', err.message);
      return NextResponse.json(
        { error: 'encryption_key_invalid', message: `Prism's encryption key is not configured correctly, so it cannot store the credentials. This is not a problem with your token. ${err.message}` },
        { status: 500 },
      );
    }
    // Never surface or log the request body / credentials.
    logError('google/manual-token failed:', err instanceof Error ? err.name : 'error');
    // This branch must carry a message. Every *expected* failure above returns
    // a specific diagnosis, so when this one returned a bare error code the
    // client fell back to "Could not connect with the pasted token" — which
    // reads as "your token is wrong" and sends people to re-mint a token that
    // was never the problem. Say plainly that this one is on us.
    return NextResponse.json(
      {
        error: 'internal_error',
        message:
          'Something went wrong on the Prism side while connecting, so this is not a problem with your token. Check the Prism logs for a line mentioning "google/manual-token" and include it if you report this.',
      },
      { status: 500 },
    );
  }
}
