import { NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { encrypt } from '@/lib/utils/crypto';
import { getRedisClient } from '@/lib/cache/getRedisClient';
import { logError } from '@/lib/utils/logError';
import { resolveRedirectUri } from '@/lib/integrations/resolveRedirectUri';
import { fetchMicrosoftAccountEmail } from '@/lib/integrations/oauth-userinfo';

const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
// Must match the authorize route's scopes (Microsoft validates scope on the
// token exchange). `User.Read` powers the "Connected as <email>" label (#100).
const SCOPES = ['Tasks.ReadWrite', 'offline_access', 'User.Read'].join(' ');
const TEMP_TOKEN_TTL = 300; // 5 minutes

interface MicrosoftTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

async function exchangeCodeForTokens(code: string, redirectUriOverride?: string): Promise<MicrosoftTokens> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirectUri = redirectUriOverride || process.env.MICROSOFT_TASKS_REDIRECT_URI ||
    `${BASE_URL}/api/auth/microsoft-tasks/callback`;

  if (!clientId || !clientSecret) {
    throw new Error('Microsoft OAuth not configured');
  }

  const response = await fetch(MICROSOFT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      scope: SCOPES,
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

  // Parse state outside try block so it's available in catch
  const { searchParams } = new URL(request.url);
  const state = searchParams.get('state');

  let taskListId: string | null = null;
  let shoppingListId: string | null = null;
  let wishMemberId: string | null = null;
  let returnSection = 'tasks';
  if (state) {
    try {
      const parsed = JSON.parse(state);
      taskListId = parsed.taskListId || null;
      shoppingListId = parsed.shoppingListId || null;
      wishMemberId = parsed.wishMemberId || null;
      returnSection = parsed.returnSection || 'tasks';
    } catch {
      // Ignore parse errors
    }
  }

  // Anchor for error redirects when caller asked for the integrations
  // page. Success redirects below always go through the list-selection
  // modal that currently only lives in the legacy section, so they stay
  // unchanged until that modal is extracted.
  const errorAnchorByEntity = wishMemberId
    ? '#microsoft-wish'
    : shoppingListId
      ? '#microsoft-shopping'
      : '#microsoft-tasks';
  const errorAnchor =
    returnSection === 'integrations' ? errorAnchorByEntity : '';

  try {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      const errorDescription = searchParams.get('error_description');
      console.error('Microsoft Tasks OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        `${BASE_URL}/settings?section=${returnSection}&error=microsoft_auth_denied${errorAnchor}`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${BASE_URL}/settings?section=${returnSection}&error=missing_code${errorAnchor}`
      );
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, resolveRedirectUri(request, '/api/auth/microsoft-tasks/callback')); // dynamic redirect URI per request (#124)
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Which Microsoft account this is, carried through the temp store to the
    // finalize step that writes the source row (#100).
    const accountEmail = await fetchMicrosoftAccountEmail(tokens.access_token);

    // Encrypt tokens for storage
    const encryptedAccessToken = encrypt(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token
      ? encrypt(tokens.refresh_token)
      : null;

    // Store tokens temporarily in Redis for MS list selection
    const redis = await getRedisClient();
    if (!redis) {
      return NextResponse.redirect(
        `${BASE_URL}/settings?section=tasks&error=redis_unavailable`
      );
    }

    // Use appropriate key based on whether this is for tasks, shopping, or wish
    const listId = wishMemberId || shoppingListId || taskListId;
    const keyType = wishMemberId ? 'wish' : shoppingListId ? 'shopping' : 'task';
    const tempKey = listId
      ? `ms-todo-temp:${auth.userId}:${keyType}:${listId}`
      : `ms-todo-temp:${auth.userId}:${keyType}:new`;

    await redis.setEx(
      tempKey,
      TEMP_TOKEN_TTL,
      JSON.stringify({
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: tokenExpiresAt.toISOString(),
        rawAccessToken: tokens.access_token, // Keep raw for immediate list fetch
        accountEmail,
      })
    );

    // Redirect to settings with flag to show MS list picker. When the
    // flow was started from inside the new Integrations cards
    // (returnSection=integrations), land on the embedded sub-section
    // with the right anchor so the user sees the modal in context.
    // Otherwise fall back to the legacy section URL (now redirected via
    // LEGACY_TO_INTEGRATIONS — keeps in-flight callbacks working).
    const useIntegrations = returnSection === 'integrations';
    let redirectUrl: string;
    if (wishMemberId) {
      redirectUrl = useIntegrations
        ? `${BASE_URL}/settings?section=integrations&selectMsList=true&wishMemberId=${wishMemberId}#microsoft-wish`
        : `${BASE_URL}/settings?section=wish&selectMsList=true&wishMemberId=${wishMemberId}`;
    } else if (shoppingListId) {
      redirectUrl = useIntegrations
        ? `${BASE_URL}/settings?section=integrations&selectMsList=true&shoppingListId=${shoppingListId}#microsoft-shopping`
        : `${BASE_URL}/settings?section=shopping&selectMsList=true&shoppingListId=${shoppingListId}`;
    } else if (taskListId) {
      redirectUrl = useIntegrations
        ? `${BASE_URL}/settings?section=integrations&selectMsList=true&taskListId=${taskListId}#microsoft-tasks`
        : `${BASE_URL}/settings?section=tasks&selectMsList=true&taskListId=${taskListId}`;
    } else {
      redirectUrl = useIntegrations
        ? `${BASE_URL}/settings?section=integrations&selectMsList=true&newConnection=true#microsoft-tasks`
        : `${BASE_URL}/settings?section=${returnSection}&selectMsList=true&newConnection=true`;
    }

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    logError('Microsoft Tasks OAuth callback error:', error);
    return NextResponse.redirect(
      `${BASE_URL}/settings?section=${returnSection}&error=microsoft_auth_failed${errorAnchor}`
    );
  }
}
