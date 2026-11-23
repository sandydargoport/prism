/**
 * credentialStore.ts
 *
 * Centralized credential lookup for OAuth integrations.
 * Checks the database (settings table) first, then falls back to env vars.
 *
 * This allows credentials to be configured through the setup wizard UI
 * without editing .env files. Existing installs using env vars continue
 * to work unchanged.
 *
 * Secrets stored in DB are encrypted with ENCRYPTION_KEY (AES-256-GCM).
 */

import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '@/lib/utils/crypto';
import { envCredential } from '@/lib/integrations/envCredential';

type GoogleCredentials = { clientId: string; clientSecret: string; redirectUri: string; gmailRedirectUri: string };
type MicrosoftCredentials = { clientId: string; clientSecret: string; redirectUri: string; tasksRedirectUri: string };
type WeatherCredentials = { apiKey: string };
type KrogerCredentials = { clientId: string; clientSecret: string; redirectUri: string };

async function getSetting(key: string): Promise<Record<string, string> | null> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, key));
    if (row?.value && typeof row.value === 'object') {
      return row.value as Record<string, string>;
    }
  } catch { /* fall through to env */ }
  return null;
}

function safeDecrypt(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try { return decrypt(value); } catch { return value; }
}

export async function getGoogleCredentials(): Promise<GoogleCredentials | null> {
  const stored = await getSetting('credentials.google');
  if (stored?.clientId) {
    return {
      clientId: safeDecrypt(stored.clientId) ?? stored.clientId ?? '',
      clientSecret: safeDecrypt(stored.clientSecret) ?? stored.clientSecret ?? '',
      redirectUri: stored.redirectUri ?? process.env.GOOGLE_REDIRECT_URI ?? '',
      gmailRedirectUri: stored.gmailRedirectUri ?? process.env.GOOGLE_GMAIL_REDIRECT_URI ?? '',
    };
  }
  // envCredential reads a blank value or the .env.example placeholder as unset,
  // so an unedited copy of the example file does not count as set up.
  const clientId = envCredential('GOOGLE_CLIENT_ID');
  const clientSecret = envCredential('GOOGLE_CLIENT_SECRET');
  // redirectUri is derived per-request now (#124); the env var is an optional
  // fallback and no longer required for the config to count as "set up".
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? '';
  const gmailRedirectUri = process.env.GOOGLE_GMAIL_REDIRECT_URI ?? redirectUri ?? '';
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri, gmailRedirectUri };
}

export async function getMicrosoftCredentials(): Promise<MicrosoftCredentials | null> {
  const stored = await getSetting('credentials.microsoft');
  if (stored?.clientId) {
    return {
      clientId: safeDecrypt(stored.clientId) ?? stored.clientId ?? '',
      clientSecret: safeDecrypt(stored.clientSecret) ?? stored.clientSecret ?? '',
      redirectUri: stored.redirectUri ?? process.env.MICROSOFT_REDIRECT_URI ?? '',
      tasksRedirectUri: stored.tasksRedirectUri ?? process.env.MICROSOFT_TASKS_REDIRECT_URI ?? stored.redirectUri ?? '',
    };
  }
  const clientId = envCredential('MICROSOFT_CLIENT_ID');
  const clientSecret = envCredential('MICROSOFT_CLIENT_SECRET');
  // redirectUri is derived per-request now (#124); env var is an optional fallback.
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI ?? '';
  const tasksRedirectUri = process.env.MICROSOFT_TASKS_REDIRECT_URI ?? redirectUri ?? '';
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri, tasksRedirectUri };
}

export async function getWeatherApiKey(): Promise<string | null> {
  const stored = await getSetting('credentials.weather');
  if (stored?.apiKey) {
    return safeDecrypt(stored.apiKey) ?? stored.apiKey;
  }
  return process.env.OPENWEATHER_API_KEY ?? null;
}

export async function getKrogerCredentials(): Promise<KrogerCredentials | null> {
  const stored = await getSetting('credentials.kroger');
  if (stored?.clientId) {
    return {
      clientId: safeDecrypt(stored.clientId) ?? stored.clientId ?? '',
      clientSecret: safeDecrypt(stored.clientSecret) ?? stored.clientSecret ?? '',
      redirectUri: stored.redirectUri ?? process.env.KROGER_REDIRECT_URI ?? '',
    };
  }
  const clientId = process.env.KROGER_CLIENT_ID;
  const clientSecret = process.env.KROGER_CLIENT_SECRET;
  const redirectUri = process.env.KROGER_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}
