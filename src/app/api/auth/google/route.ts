import { NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { getGoogleAuthUrl } from '@/lib/integrations/google-calendar';
import { logError } from '@/lib/utils/logError';
import { isOAuthNotConfigured, oauthSetupRedirect } from '@/lib/integrations/oauthSetupRedirect';

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const reauth = searchParams.get('reauth');
    const returnSection = searchParams.get('returnSection') || 'connections';
    const stateObj: Record<string, string> = { returnSection };
    if (userId) stateObj.userId = userId;
    if (reauth) stateObj.reauth = reauth;
    const state = JSON.stringify(stateObj);
    const authUrl = await getGoogleAuthUrl(state);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    if (isOAuthNotConfigured(error)) return oauthSetupRedirect('google');
    logError('Failed to initiate Google OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Google authentication' },
      { status: 500 }
    );
  }
}
