import { NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { getGoogleAuthUrl } from '@/lib/integrations/google-calendar';
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
    const reauth = searchParams.get('reauth');
    const returnSection = searchParams.get('returnSection') || 'connections';
    // State is now an opaque, single-use nonce bound server-side to this
    // session; the callback reads returnSection/reauth from the stored payload
    // and derives the owning userId from the session (never from state). The
    // old client-supplied `userId` param is intentionally dropped.
    const payload: Record<string, unknown> = { returnSection };
    if (reauth) payload.reauth = reauth;
    const state = await createOAuthState('google', auth.userId, payload);
    const redirectUri = resolveRedirectUri(request, '/api/auth/google/callback');
    const authUrl = await getGoogleAuthUrl(state, redirectUri);

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
