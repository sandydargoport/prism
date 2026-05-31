import { NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { getGmailAuthUrl } from '@/lib/integrations/gmail';
import { logError } from '@/lib/utils/logError';

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

    const state = JSON.stringify({ returnSection });
    const authUrl = await getGmailAuthUrl(state);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    logError('Failed to initiate Gmail OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Gmail authentication' },
      { status: 500 }
    );
  }
}
