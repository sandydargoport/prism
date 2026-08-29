import { NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { logError } from '@/lib/utils/logError';
import { oauthSetupRedirect } from '@/lib/integrations/oauthSetupRedirect';
import { resolveRedirectUri } from '@/lib/integrations/resolveRedirectUri';
import { getGoogleCredentials } from '@/lib/integrations/credentialStore';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
// `openid email` lets us identify which Google account authorized, for the
// "Connected as <email>" label on the Integrations card (#100).
import { TASKS_BROWSER_SCOPES } from '@/lib/integrations/googleScopes';

const SCOPES = TASKS_BROWSER_SCOPES;

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageIntegrations');
  if (forbidden) return forbidden;

  // Credentials may be stored in the database (Settings, or the paste-a-token
  // flow) rather than the environment. Reading the env var directly made this
  // route dead-end for every in-app configured install: no env var, so it
  // redirected to a setup wizard that no longer offers Google once setup is
  // complete. Calendar and Gmail have always gone through the credential store.
  const credentials = await getGoogleCredentials();
  const clientId = credentials?.clientId;
  const redirectUri = resolveRedirectUri(request, '/api/auth/google-tasks/callback'); // dynamic redirect URI per request (#124)

  if (!clientId) {
    return oauthSetupRedirect('google');
  }

  try {
    const { searchParams } = new URL(request.url);
    const taskListId = searchParams.get('taskListId');
    const returnSection = searchParams.get('returnSection') || 'tasks';

    const state = JSON.stringify({
      taskListId: taskListId || null,
      returnSection,
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
  } catch (error) {
    logError('Failed to initiate Google Tasks OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Google authentication' },
      { status: 500 }
    );
  }
}
