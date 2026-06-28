import { NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { encrypt } from '@/lib/utils/crypto';
import { getRedisClient } from '@/lib/cache/getRedisClient';
import { logError } from '@/lib/utils/logError';
import { resolveRedirectUri } from '@/lib/integrations/resolveRedirectUri';
import { fetchGoogleAccountEmail } from '@/lib/integrations/oauth-userinfo';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEMP_TOKEN_TTL = 300; // 5 minutes

interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

async function exchangeCodeForTokens(code: string, redirectUriOverride?: string): Promise<GoogleTokens> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = redirectUriOverride || process.env.GOOGLE_TASKS_REDIRECT_URI ||
    `${BASE_URL}/api/auth/google-tasks/callback`;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth not configured');
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json();
}

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageIntegrations');
  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const state = searchParams.get('state');

  let taskListId: string | null = null;
  // Default returnSection is still 'tasks' — Google Tasks OAuth flows
  // ALWAYS end in a list-selection modal which currently only lives in
  // the legacy TaskIntegrationsSection. Until that modal is extracted into
  // the new Integrations cards (later phase), success redirects stay
  // pointed at 'tasks'. Error redirects can honor returnSection.
  let returnSection = 'tasks';
  if (state) {
    try {
      const parsed = JSON.parse(state);
      taskListId = parsed.taskListId || null;
      returnSection = parsed.returnSection || 'tasks';
    } catch { /* ignore */ }
  }

  // Anchor for error redirects when returnSection === 'integrations'.
  const errorAnchor =
    returnSection === 'integrations' ? '#google-tasks' : '';

  try {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      logError('Google Tasks OAuth error:', error);
      return NextResponse.redirect(
        `${BASE_URL}/settings?section=${returnSection}&error=google_tasks_auth_denied${errorAnchor}`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${BASE_URL}/settings?section=${returnSection}&error=missing_code${errorAnchor}`
      );
    }

    const tokens = await exchangeCodeForTokens(code, resolveRedirectUri(request, '/api/auth/google-tasks/callback')); // dynamic redirect URI per request (#124)
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Which Google account this is, carried through the temp store to the
    // finalize step that writes the task_sources row (#100).
    const accountEmail = await fetchGoogleAccountEmail(tokens.access_token);

    const encryptedAccessToken = encrypt(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token
      ? encrypt(tokens.refresh_token)
      : null;

    // Store tokens temporarily in Redis
    const redis = await getRedisClient();
    if (!redis) {
      return NextResponse.redirect(
        `${BASE_URL}/settings?section=tasks&error=redis_unavailable`
      );
    }

    const tempKey = taskListId
      ? `google-tasks-temp:${auth.userId}:task:${taskListId}`
      : `google-tasks-temp:${auth.userId}:task:new`;

    await redis.setEx(
      tempKey,
      TEMP_TOKEN_TTL,
      JSON.stringify({
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: tokenExpiresAt.toISOString(),
        rawAccessToken: tokens.access_token,
        accountEmail,
      })
    );

    // Land on the new Integrations cards' Google Tasks sub-section when
    // the flow was initiated from there; otherwise the legacy ?section=tasks
    // (redirected via LEGACY_TO_INTEGRATIONS so in-flight callbacks survive).
    const useIntegrations = returnSection === 'integrations';
    const redirectUrl = taskListId
      ? useIntegrations
        ? `${BASE_URL}/settings?section=integrations&selectGoogleTasksList=true&taskListId=${taskListId}#google-tasks`
        : `${BASE_URL}/settings?section=tasks&selectGoogleTasksList=true&taskListId=${taskListId}`
      : useIntegrations
        ? `${BASE_URL}/settings?section=integrations&selectGoogleTasksList=true&newConnection=true#google-tasks`
        : `${BASE_URL}/settings?section=tasks&selectGoogleTasksList=true&newConnection=true`;

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    logError('Google Tasks OAuth callback error:', error);
    return NextResponse.redirect(
      `${BASE_URL}/settings?section=${returnSection}&error=google_tasks_auth_failed${errorAnchor}`
    );
  }
}
