import { NextResponse } from 'next/server';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

/**
 * True when an OAuth "initiate" failure is just "credentials aren't configured
 * yet" rather than a real error. Every provider auth-url helper throws a message
 * containing "OAuth configuration" in that case (e.g. "Missing Google OAuth
 * configuration. Configure in Settings → Setup Wizard or set GOOGLE_CLIENT_ID…").
 */
export function isOAuthNotConfigured(error: unknown): boolean {
  return error instanceof Error && /OAuth configuration/i.test(error.message);
}

/**
 * Redirect the browser to the Integrations page with a setup prompt for the
 * given provider, instead of dumping a raw JSON 500 when the user clicks
 * "Connect" before OAuth credentials exist (issue #108). `provider` is one of
 * 'google' | 'gmail' | 'microsoft' and drives the on-page banner copy + anchor.
 */
export function oauthSetupRedirect(provider: 'google' | 'gmail' | 'microsoft'): NextResponse {
  const anchor = provider === 'gmail' ? 'gmail-bus' : provider;
  return NextResponse.redirect(
    `${BASE_URL}/settings?section=integrations&setup=${provider}#${anchor}`
  );
}
