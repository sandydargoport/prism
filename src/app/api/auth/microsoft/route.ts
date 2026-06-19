import { NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { getMicrosoftAuthUrl } from '@/lib/integrations/onedrive';
import { logError } from '@/lib/utils/logError';
import { isOAuthNotConfigured, oauthSetupRedirect } from '@/lib/integrations/oauthSetupRedirect';

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const sourceName = searchParams.get('sourceName') || 'OneDrive Photos';
    // returnSection lets the new MicrosoftProviderCard route the callback
    // back to /settings?section=integrations#microsoft-onedrive. Legacy
    // callers (ConnectedAccountsSection's Connect OneDrive button) omit
    // the param and keep the existing ?section=photos behavior.
    const returnSection = searchParams.get('returnSection') || '';

    const state = JSON.stringify({ sourceName, returnSection });
    const authUrl = await getMicrosoftAuthUrl(state);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    if (isOAuthNotConfigured(error)) return oauthSetupRedirect('microsoft');
    logError('Failed to initiate Microsoft OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Microsoft authentication' },
      { status: 500 }
    );
  }
}
