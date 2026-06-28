/**
 * OAuth account-email lookup.
 *
 * After an OAuth token exchange we fetch the email address of the account that
 * just authorized, so the Integrations cards can show "Connected as <email>"
 * (issue #100). We deliberately call the provider's lightweight userinfo/profile
 * endpoint with the freshly-minted access token rather than decoding the
 * id_token — that avoids pulling in a JWT library and works uniformly whether
 * or not the provider returned an id_token.
 *
 * Every function is best-effort: a failure here must NEVER break the OAuth
 * connection flow, so they catch everything and return null. A null email just
 * means the card renders without the address (NULL-safe column).
 */

import { logError } from '@/lib/utils/logError';

const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const GMAIL_PROFILE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/profile';
const MS_GRAPH_ME_URL = 'https://graph.microsoft.com/v1.0/me';

/**
 * Google account email via the OAuth2 userinfo endpoint.
 * Requires the `openid email` (or `userinfo.email`) scope on the access token.
 */
export async function fetchGoogleAccountEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { email?: string };
    return data.email?.toLowerCase() ?? null;
  } catch (err) {
    logError('fetchGoogleAccountEmail failed (non-fatal):', err);
    return null;
  }
}

/**
 * Gmail account email via the Gmail profile endpoint. This is already covered
 * by the `gmail.readonly` scope, so the Gmail/bus flow needs no extra scope.
 */
export async function fetchGmailAccountEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(GMAIL_PROFILE_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { emailAddress?: string };
    return data.emailAddress?.toLowerCase() ?? null;
  } catch (err) {
    logError('fetchGmailAccountEmail failed (non-fatal):', err);
    return null;
  }
}

/**
 * Microsoft account email via Graph /me. Requires the `User.Read` scope on the
 * access token. Personal Microsoft accounts populate `mail`; some work/school
 * and consumer accounts only have `userPrincipalName`, so fall back to it.
 */
export async function fetchMicrosoftAccountEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(MS_GRAPH_ME_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { mail?: string | null; userPrincipalName?: string | null };
    const email = data.mail || data.userPrincipalName || null;
    return email ? email.toLowerCase() : null;
  } catch (err) {
    logError('fetchMicrosoftAccountEmail failed (non-fatal):', err);
    return null;
  }
}
