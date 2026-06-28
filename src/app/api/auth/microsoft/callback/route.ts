import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { photoSources } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { exchangeCodeForTokens } from '@/lib/integrations/onedrive';
import { encrypt } from '@/lib/utils/crypto';
import { logError } from '@/lib/utils/logError';
import { resolveRedirectUri } from '@/lib/integrations/resolveRedirectUri';
import { fetchMicrosoftAccountEmail } from '@/lib/integrations/oauth-userinfo';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

export async function GET(request: Request) {
  // Note: no requireAuth here — Microsoft calls back without a Prism session cookie.
  // The state param carries enough context; sensitive ops are gated by the token exchange itself.

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');

  // Parse state once at top so error redirects (including the catch
  // block) can honor returnSection without re-parsing.
  let sourceName = 'OneDrive Photos';
  let returnSection = '';
  if (state) {
    try {
      const parsed = JSON.parse(state);
      sourceName = parsed.sourceName || sourceName;
      returnSection = parsed.returnSection || '';
    } catch { /* ignore */ }
  }
  const errorSection = returnSection === 'integrations' ? 'integrations' : 'connections';
  const errorAnchor = returnSection === 'integrations' ? '#microsoft' : '';

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
