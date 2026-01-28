/**
 * ============================================================================
 * PRISM - Google OAuth Callback Route
 * ============================================================================
 *
 * Handles the callback from Google after user grants permission.
 * Exchanges the authorization code for tokens and stores them.
 *
 * ============================================================================
 */

import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { calendarSources } from '@/lib/db/schema';
import {
  exchangeCodeForTokens,
  fetchCalendarList,
} from '@/lib/integrations/google-calendar';

// Hardcoded base URL for OAuth redirects
// Must match the redirect URI authorized in Google Console
const BASE_URL = 'http://localhost:3000';

/**
 * GET /api/auth/google/callback
 * Handles OAuth callback from Google
 */
export async function GET(request: Request) {

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');

    // Check for errors from Google
    if (error) {
      console.error('Google OAuth error:', error);
      return NextResponse.redirect(`${BASE_URL}/settings?error=google_auth_denied`);
    }

    // Ensure we have an authorization code
    if (!code) {
      return NextResponse.redirect(`${BASE_URL}/settings?error=missing_code`);
    }

    // Parse state to get user ID
    let userId: string | null = null;
    if (state) {
      try {
        const parsed = JSON.parse(state);
        userId = parsed.userId;
      } catch {
        // State parsing failed, continue without user ID
      }
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Calculate token expiration time
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Fetch user's calendars
    const calendars = await fetchCalendarList(tokens.access_token);

    // Store each calendar as a calendar source
    for (const calendar of calendars) {
      // Check if we already have this calendar
      const existing = await db.query.calendarSources.findFirst({
        where: (cs, { and, eq }) =>
          and(
            eq(cs.provider, 'google'),
            eq(cs.sourceCalendarId, calendar.id)
          ),
      });

      if (existing) {
        // Update existing calendar source with new tokens
        await db
          .update(calendarSources)
          .set({
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token || existing.refreshToken,
            tokenExpiresAt,
            updatedAt: new Date(),
          })
          .where(eq(calendarSources.id, existing.id));
      } else {
        // Create new calendar source - enable ALL calendars by default
        // Truncate names to 255 chars to prevent database errors
        const calendarName = (calendar.summary || 'Untitled Calendar').slice(0, 255);

        await db.insert(calendarSources).values({
          userId: userId || undefined,
          provider: 'google',
          sourceCalendarId: calendar.id,
          dashboardCalendarName: calendarName,
          displayName: calendarName,
          color: calendar.backgroundColor || undefined,
          enabled: true, // Enable all calendars by default
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt,
        });
      }
    }

    // Redirect back to settings with success message
    return NextResponse.redirect(`${BASE_URL}/settings?success=google_connected`);
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return NextResponse.redirect(`${BASE_URL}/settings?error=google_auth_failed`);
  }
}
