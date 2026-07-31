import { NextResponse } from 'next/server';
import { getDisplayAuth } from '@/lib/auth';
import { getGoogleCredentials, getMicrosoftCredentials } from '@/lib/integrations/credentialStore';
import { logError } from '@/lib/utils/logError';

/**
 * Whether the OAuth *app* (client id/secret) is configured for each
 * provider — never whether any particular user has connected an account.
 * Drives keyless-first gating in the UI: a fresh instance with no OAuth
 * app registered shouldn't dangle a "Connect" button that dead-ends (#178).
 * Never returns the secret itself, only a boolean.
 */
export async function GET() {
  const auth = await getDisplayAuth();
  if (!auth) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const [google, microsoft] = await Promise.all([
      getGoogleCredentials(),
      getMicrosoftCredentials(),
    ]);

    return NextResponse.json({
      google: !!google,
      microsoft: !!microsoft,
    });
  } catch (error) {
    logError('Error checking OAuth configuration status:', error);
    return NextResponse.json(
      { error: 'Failed to check OAuth configuration status' },
      { status: 500 }
    );
  }
}
