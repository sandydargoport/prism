import { NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { getGmailAuthUrl } from '@/lib/integrations/gmail';
import { logError } from '@/lib/utils/logError';
import { isOAuthNotConfigured, oauthSetupRedirect } from '@/lib/integrations/oauthSetupRedirect';
import { resolveRedirectUri } from '@/lib/integrations/resolveRedirectUri';
import { createOAuthState } from '@/lib/auth/oauthState';

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    // returnSection lets the new GoogleProviderCard route the callback back
    // to /settings?section=integrations#google-bus. Default 'bus' preserves
    // legacy callers (BusTrackingSection's Connect Gmail button).
    const returnSection = searchParams.get('returnSection') || 'bus';

    // A single-use nonce bound to this session (#1221).
    const state = await createOAuthState('google-bus', auth.userId, { returnSection });
    const redirectUri = resolveRedirectUri(request, '/api/auth/google-bus/callback'); // dynamic redirect URI per request (#124)
    const authUrl = await getGmailAuthUrl(state, redirectUri);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    if (isOAuthNotConfigured(error)) return oauthSetupRedirect('gmail');
    logError('Failed to initiate Gmail OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Gmail authentication' },
      { status: 500 }
    );
  }
}
