import { NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { photoSources } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { exchangeCodeForTokens } from '@/lib/integrations/onedrive';
import { encrypt } from '@/lib/utils/crypto';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');

    if (error) {
      const errorDescription = searchParams.get('error_description');
      console.error('Microsoft OAuth error:', error, errorDescription);
      return NextResponse.redirect(`${BASE_URL}/settings?section=photos&error=microsoft_auth_denied`);
    }

    if (!code) {
      return NextResponse.redirect(`${BASE_URL}/photos?error=missing_code`);
    }

    let sourceName = 'OneDrive Photos';
    if (state) {
      try {
        const parsed = JSON.parse(state);
        sourceName = parsed.sourceName || sourceName;
      } catch {
        // Ignore parse errors
      }
    }

    const tokens = await exchangeCodeForTokens(code);
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const encryptedAccessToken = encrypt(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;

    const [existing] = await db.select().from(photoSources).where(eq(photoSources.type, 'onedrive')).limit(1);
    if (existing) {
      await db.update(photoSources).set({
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken || existing.refreshToken,
        tokenExpiresAt,
      }).where(eq(photoSources.id, existing.id));
    } else {
      await db.insert(photoSources).values({
        type: 'onedrive',
        name: sourceName,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt,
      });
    }

    return NextResponse.redirect(`${BASE_URL}/settings?section=photos&success=microsoft_connected`);
  } catch (error) {
    console.error('Microsoft OAuth callback error:', error);
    return NextResponse.redirect(`${BASE_URL}/settings?error=microsoft_auth_failed`);
  }
}
