import { NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { encrypt } from '@/lib/utils/crypto';
import { getRedisClient } from '@/lib/cache/getRedisClient';

const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SCOPES = ['Tasks.ReadWrite', 'offline_access'].join(' ');
const TEMP_TOKEN_TTL = 300; // 5 minutes

interface MicrosoftTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

async function exchangeCodeForTokens(code: string): Promise<MicrosoftTokens> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirectUri = process.env.MICROSOFT_TASKS_REDIRECT_URI ||
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
  let returnSection = 'tasks';
  if (state) {
    try {
      const parsed = JSON.parse(state);
      taskListId = parsed.taskListId || null;
      shoppingListId = parsed.shoppingListId || null;
      returnSection = parsed.returnSection || 'tasks';
    } catch {
      // Ignore parse errors
    }
  }

  try {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      const errorDescription = searchParams.get('error_description');
      console.error('Microsoft Tasks OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        `${BASE_URL}/settings?section=${returnSection}&error=microsoft_auth_denied`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${BASE_URL}/settings?section=${returnSection}&error=missing_code`
      );
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

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

    // Use appropriate key based on whether this is for tasks or shopping
    const listId = shoppingListId || taskListId;
    const keyType = shoppingListId ? 'shopping' : 'task';
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
      })
    );

    // Redirect to settings with flag to show MS list picker
    let redirectUrl: string;
    if (shoppingListId) {
      redirectUrl = `${BASE_URL}/settings?section=shopping&selectMsList=true&shoppingListId=${shoppingListId}`;
    } else if (taskListId) {
      redirectUrl = `${BASE_URL}/settings?section=tasks&selectMsList=true&taskListId=${taskListId}`;
    } else {
      redirectUrl = `${BASE_URL}/settings?section=${returnSection}&selectMsList=true&newConnection=true`;
    }

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Microsoft Tasks OAuth callback error:', error);
    return NextResponse.redirect(
      `${BASE_URL}/settings?section=${returnSection}&error=microsoft_auth_failed`
    );
  }
}
