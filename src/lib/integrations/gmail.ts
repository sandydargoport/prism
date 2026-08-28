/**
 * Gmail API integration for bus tracking email polling.
 * Reuses existing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET with gmail.readonly scope.
 * Tokens stored in apiCredentials table (service: 'gmail-bus').
 */

const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
import { GMAIL_BROWSER_SCOPES } from '@/lib/integrations/googleScopes';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_API = 'https://www.googleapis.com/gmail/v1';

const SCOPES = GMAIL_BROWSER_SCOPES;

export interface GmailTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  payload?: GmailMessagePayload;
  internalDate?: string;
}

interface GmailMessagePayload {
  headers?: { name: string; value: string }[];
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailMessagePart[];
}

interface GmailMessagePart {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailMessagePart[];
}

async function getConfig() {
  const { getGoogleCredentials } = await import('@/lib/integrations/credentialStore');
  const creds = await getGoogleCredentials();
  if (!creds) {
    throw new Error(
      'Missing Gmail OAuth configuration. Configure in Settings → Setup Wizard or set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_GMAIL_REDIRECT_URI in .env'
    );
  }
  return { clientId: creds.clientId, clientSecret: creds.clientSecret, redirectUri: creds.gmailRedirectUri };
}

export async function getGmailAuthUrl(state?: string, redirectUriOverride?: string): Promise<string> {
  const { clientId, redirectUri } = await getConfig();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUriOverride || redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
  });

  if (state) {
    params.set('state', state);
  }

  return `${GOOGLE_OAUTH_URL}?${params.toString()}`;
}

export async function exchangeGmailCodeForTokens(code: string, redirectUriOverride?: string): Promise<GmailTokens> {
  const { clientId, clientSecret, redirectUri } = await getConfig();

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUriOverride || redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange Gmail code for tokens: ${error}`);
  }

  return response.json();
}

export async function refreshGmailAccessToken(refreshToken: string): Promise<GmailTokens> {
  const { clientId, clientSecret } = await getConfig();

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (errorText.includes('invalid_grant') || errorText.includes('Token has been expired or revoked')) {
      throw new TokenRevokedError(`Gmail token expired or revoked: ${errorText}`);
    }
    throw new Error(`Failed to refresh Gmail token: ${errorText}`);
  }

  return response.json();
}

export class TokenRevokedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenRevokedError';
  }
}

/**
 * Fetch emails matching a query.
 * Returns message IDs — call getEmailContent for full body.
 *
 * Options:
 * - unreadOnly: append `is:unread` to query
 * - labelName: append `label:<name>` to query (for Gmail-filtered emails)
 * - afterDate: append `after:YYYY/MM/DD` to query (limit search window)
 * - maxResults: max emails to return (default 20)
 */
export async function fetchEmails(
  accessToken: string,
  query: string,
  options: { unreadOnly?: boolean; labelName?: string; afterDate?: string; maxResults?: number } = {}
): Promise<{ id: string; threadId: string }[]> {
  const { unreadOnly = false, labelName, afterDate, maxResults = 20 } = options;
  let fullQuery = query;
  if (unreadOnly) fullQuery += ' is:unread';
  if (labelName) fullQuery += ` label:${labelName}`;
  if (afterDate) fullQuery += ` after:${afterDate}`;

  const allMessages: { id: string; threadId: string }[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: fullQuery,
      maxResults: Math.min(maxResults - allMessages.length, 100).toString(),
    });
    if (pageToken) params.set('pageToken', pageToken);

    const response = await fetch(
      `${GMAIL_API}/users/me/messages?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch Gmail messages: ${error}`);
    }

    const data = await response.json();
    const messages = data.messages || [];
    allMessages.push(...messages);
    pageToken = data.nextPageToken;
  } while (pageToken && allMessages.length < maxResults);

  return allMessages;
}

/**
 * Get full email content by message ID.
 */
export async function getEmailContent(
  accessToken: string,
  messageId: string
): Promise<GmailMessage> {
  const response = await fetch(
    `${GMAIL_API}/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch email content: ${error}`);
  }

  return response.json();
}

/**
 * Mark an email as read by removing the UNREAD label.
 */
export async function markEmailAsRead(
  accessToken: string,
  messageId: string
): Promise<void> {
  const response = await fetch(
    `${GMAIL_API}/users/me/messages/${messageId}/modify`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to mark email as read: ${error}`);
  }
}

/**
 * Extract subject, plain text body, and date from a Gmail message.
 */
export function extractEmailFields(message: GmailMessage): {
  subject: string;
  body: string;
  date: Date;
  messageId: string;
} {
  const headers = message.payload?.headers || [];
  const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
  const dateStr = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';

  // Extract plain text body
  const body = extractPlainTextBody(message.payload);

  return {
    subject,
    body,
    date: dateStr ? new Date(dateStr) : new Date(Number(message.internalDate)),
    messageId: message.id,
  };
}

function extractPlainTextBody(payload?: GmailMessagePayload): string {
  if (!payload) return '';

  // Simple message — body is directly in payload
  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    // If the payload is HTML (single-part HTML email), strip tags
    if (payload.mimeType === 'text/html' || decoded.trimStart().startsWith('<')) {
      return stripHtmlTags(decoded);
    }
    return decoded;
  }

  // Multipart message — find text/plain part
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
      // Recurse into nested parts
      if (part.parts) {
        const nested = extractPlainTextBody({ parts: part.parts });
        if (nested) return nested;
      }
    }
    // Fallback: try text/html if no text/plain found
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return stripHtmlTags(decodeBase64Url(part.body.data));
      }
    }
  }

  return '';
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
