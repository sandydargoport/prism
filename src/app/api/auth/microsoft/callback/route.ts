import { NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { photoSources } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { exchangeCodeForTokens } from '@/lib/integrations/onedrive';
import { encrypt } from '@/lib/utils/crypto';
import { logError } from '@/lib/utils/logError';
import { resolveRedirectUri } from '@/lib/integrations/resolveRedirectUri';
import { fetchMicrosoftAccountEmail } from '@/lib/integrations/oauth-userinfo';
import { consumeOAuthState } from '@/lib/auth/oauthState';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

export async function GET(request: Request) {
  // The callback is a top-level navigation, so the Prism session cookie is
  // sent — require it (was previously unauthenticated, letting any valid code
  // bind a OneDrive account/token to the global photo source).
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');

  // Verify + consume the state nonce, bound to this session at /authorize.
  // sourceName/returnSection come from the stored payload; Redis-down proceeds
  // with defaults (degraded), a bad/absent nonce with Redis up is rejected.
  const consumed = await consumeOAuthState('microsoft', state, auth.userId);
  let sourceName = 'OneDrive Photos';
  let returnSection = '';
  if (consumed.status === 'ok') {
    sourceName = (consumed.payload.sourceName as string) || sourceName;
    returnSection = (consumed.payload.returnSection as string) || '';
  }
  const errorSection = returnSection === 'integrations' ? 'integrations' : 'connections';
  const errorAnchor = returnSection === 'integrations' ? '#microsoft' : '';

  if (consumed.status === 'invalid') {
    return NextResponse.redirect(`${BASE_URL}/settings?section=${errorSection}&error=microsoft_state_mismatch${errorAnchor}`);
  }

  try {
    if (error) {
      const errorDescription = searchParams.get('error_description');
      console.error('Microsoft OAuth error:', error, errorDescription);
      return NextResponse.redirect(`${BASE_URL}/settings?section=${errorSection}&error=microsoft_auth_denied${errorAnchor}`);
    }

    if (!code) {
      return NextResponse.redirect(`${BASE_URL}/settings?section=${errorSection}&error=missing_code${errorAnchor}`);
    }

    const tokens = await exchangeCodeForTokens(code, resolveRedirectUri(request, '/api/auth/microsoft/callback')); // dynamic redirect URI per request (#124)
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const encryptedAccessToken = encrypt(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;

    // Identify the Microsoft account for the "Connected as <email>" label (#100).
    const accountEmail = await fetchMicrosoftAccountEmail(tokens.access_token);

    const [existing] = await db.select().from(photoSources).where(eq(photoSources.type, 'onedrive')).limit(1);
    let sourceId: string;
    if (existing) {
      await db.update(photoSources).set({
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken || existing.refreshToken,
        tokenExpiresAt,
        accountEmail: accountEmail ?? undefined,
      }).where(eq(photoSources.id, existing.id));
      sourceId = existing.id;
    } else {
      const [created] = await db.insert(photoSources).values({
        type: 'onedrive',
        name: sourceName,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt,
        accountEmail,
      }).returning();
      sourceId = created?.id ?? '';
    }

    // When initiated from the new Integrations card, land on the OneDrive
    // sub-section so the user sees what they just connected. Legacy callers
    // (no returnSection in state) fall through to the existing photos page.
    if (returnSection === 'integrations') {
      return NextResponse.redirect(`${BASE_URL}/settings?section=integrations&success=onedrive_connected&sourceId=${sourceId}#microsoft-onedrive`);
    }
    return NextResponse.redirect(`${BASE_URL}/settings?section=photos&success=onedrive_connected&sourceId=${sourceId}`);
  } catch (error) {
    logError('Microsoft OAuth callback error:', error);
    return NextResponse.redirect(`${BASE_URL}/settings?section=${errorSection}&error=microsoft_auth_failed${errorAnchor}`);
  }
}
